import { Injectable } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { accessSync, constants, statSync, type Stats } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, sep } from 'node:path';
import { env } from 'node:process';
import { z } from 'zod';
import { ConfigurationError, appErrorCodes } from '#shared/errors';

export const envSchema = z
  .object({
    FOUNDATION_DOCS_PATH: z
      .string({ error: 'FOUNDATION_DOCS_PATH is required.' })
      .trim()
      .min(1, 'FOUNDATION_DOCS_PATH cannot be empty.'),
  })
  .transform(({ FOUNDATION_DOCS_PATH }) => ({
    foundationDocsPath: FOUNDATION_DOCS_PATH,
  }));

export type EnvConfig = z.output<typeof envSchema>;

export interface AppConfig {
  readonly foundationDocs: {
    readonly discoveryRootPath: string;
  };
  readonly dogma: {
    readonly outputDir: string;
  };
}

@Injectable()
export class AppConfigService {
  readonly value: AppConfig;

  constructor() {
    loadDotenv({ path: '.env.local', quiet: true });
    loadDotenv({ path: '.env', quiet: true });
    this.value = this.mapEnv(this.parseEnv(env));
  }

  private parseEnv(sourceEnv: NodeJS.ProcessEnv): EnvConfig {
    const parsed = envSchema.safeParse(sourceEnv);
    if (!parsed.success) {
      const hasMissingFoundationPath = parsed.error.issues.some((issue) => issue.path.join('.') === 'FOUNDATION_DOCS_PATH' && issue.code === 'invalid_type');
      throw new ConfigurationError(
        ['Invalid configuration.', z.prettifyError(parsed.error)].join('\n'),
        hasMissingFoundationPath ? appErrorCodes.envVarMissing : appErrorCodes.configurationInvalid,
      );
    }

    return parsed.data;
  }

  private mapEnv(envConfig: EnvConfig): AppConfig {
    return {
      foundationDocs: {
        discoveryRootPath: this.parseReadableLocalPath(envConfig.foundationDocsPath, 'FOUNDATION_DOCS_PATH'),
      },
      dogma: {
        outputDir: this.toAbsoluteLocalPath('.tl-assistant/dogma'),
      },
    };
  }

  toAbsoluteLocalPath(input: string): string {
    return resolve(this.normalizeLocalPathInput(input).replace(/^~(?=$|\/)/, homedir()));
  }

  private normalizeLocalPathInput(input: string): string {
    if (sep === '\\') return input;

    return input.replace(/\\ /g, ' ');
  }

  private parseReadableLocalPath(input: string, envName: string): string {
    const normalizedPath = this.toAbsoluteLocalPath(input);

    let stat: Stats;
    try {
      accessSync(normalizedPath, constants.R_OK);
      stat = statSync(normalizedPath);
    } catch {
      throw new ConfigurationError(`${envName} must exist and be readable: ${normalizedPath}`, appErrorCodes.localPathNotReadable);
    }

    if (!stat.isDirectory() && !stat.isFile()) {
      throw new ConfigurationError(`${envName} must be a local file or directory: ${normalizedPath}`, appErrorCodes.localPathInvalidKind);
    }

    return normalizedPath;
  }
}
