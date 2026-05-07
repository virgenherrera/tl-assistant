import { Logger, type DynamicModule, type Type } from '@nestjs/common';
import { ConfigModule as NestConfigModule, getConfigToken, registerAs } from '@nestjs/config';
import type { ConfigObject } from '@nestjs/config';
import { env } from 'node:process';
import { z, ZodError } from 'zod';
import { ConfigurationError, appErrorCodes } from '#shared/errors';

type EnvProvider = () => NodeJS.ProcessEnv;
type ZodConfigClass = Type<unknown> & {
  readonly schema: z.ZodType<unknown>;
};

export interface AppConfigModuleOptions {
  readonly cache?: boolean;
  readonly expandVariables?: boolean;
  readonly isGlobal?: boolean;
  readonly envFilePath?: readonly string[];
  readonly envProvider?: EnvProvider;
  readonly configClasses: readonly [ZodConfigClass, ...ZodConfigClass[]];
}

interface ResolvedAppConfigModuleOptions {
  readonly cache: boolean;
  readonly expandVariables: boolean;
  readonly isGlobal: boolean;
  readonly envFilePath: readonly string[];
  readonly envProvider: () => NodeJS.ProcessEnv;
  readonly configClasses: readonly [ZodConfigClass, ...ZodConfigClass[]];
}

export class AppConfigModule {
  private static readonly logger = new Logger(AppConfigModule.name);

  static forRoot(options: AppConfigModuleOptions): DynamicModule {
    const resolved = this.resolveOptions(options);
    const configFactories = resolved.configClasses.map((configClass) => this.createConfigFactory(configClass, resolved));

    this.logger.log(`loaded ${resolved.configClasses.length} config namespace${resolved.configClasses.length === 1 ? '' : 's'}`);

    return {
      module: AppConfigModule,
      imports: [
        NestConfigModule.forRoot({
          cache: resolved.cache,
          envFilePath: [...resolved.envFilePath],
          expandVariables: resolved.expandVariables,
          isGlobal: resolved.isGlobal,
          load: configFactories,
        }),
      ],
      exports: [NestConfigModule],
    };
  }

  static getToken(configClass: Type<unknown>): string {
    return getConfigToken(configClass.name);
  }

  private static resolveOptions(options: AppConfigModuleOptions): ResolvedAppConfigModuleOptions {
    if (options.configClasses.length === 0) {
      throw new TypeError('AppConfigModule.forRoot requires at least one config class.');
    }

    const envProvider = options.envProvider ?? (() => env);
    let cachedEnvProviderResult: NodeJS.ProcessEnv | null = null;

    return {
      cache: options.cache ?? false,
      envFilePath: options.envFilePath ?? ['.env.local', '.env'],
      expandVariables: options.expandVariables ?? true,
      isGlobal: options.isGlobal ?? true,
      configClasses: options.configClasses,
      envProvider: () => {
        cachedEnvProviderResult ??= envProvider();
        return cachedEnvProviderResult;
      },
    };
  }

  private static createConfigFactory(configClass: ZodConfigClass, options: ResolvedAppConfigModuleOptions): ReturnType<typeof registerAs> {
    return registerAs(configClass.name, (): ConfigObject => {
      let parseResult: ReturnType<typeof configClass.schema.safeParse>;

      try {
        parseResult = configClass.schema.safeParse(options.envProvider());
      } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        throw new ConfigurationError(`Configuration namespace "${configClass.name}" failed while mapping values.`, appErrorCodes.configurationInvalid, error);
      }

      if (!parseResult.success) {
        throw buildValidationError(configClass, parseResult.error);
      }

      return Object.freeze(parseResult.data as ConfigObject);
    });
  }
}

function buildValidationError(configClass: ZodConfigClass, error: ZodError): ConfigurationError {
  const hasMissingEnvVar = error.issues.some((issue) => issue.code === 'invalid_type');
  const title = `Configuration validation error(s) in namespace "${configClass.name}"`;
  const footer = 'Verify the values provided via environment variables or your .env file.';

  return new ConfigurationError(
    [title, z.prettifyError(error), footer].join('\n'),
    hasMissingEnvVar ? appErrorCodes.envVarMissing : appErrorCodes.configurationInvalid,
  );
}
