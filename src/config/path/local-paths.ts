import { accessSync, constants, statSync, type Stats } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, sep } from 'node:path';
import { ConfigurationError, appErrorCodes } from '#shared/errors';

export function toAbsoluteLocalPath(input: string): string {
  return resolve(normalizeLocalPathInput(input).replace(/^~(?=$|\/|\\)/, homedir()));
}

export function parseReadableLocalPath(input: string, configKey: string): string {
  const normalizedPath = toAbsoluteLocalPath(input);

  let stats: Stats;
  try {
    accessSync(normalizedPath, constants.R_OK);
    stats = statSync(normalizedPath);
  } catch {
    throw new ConfigurationError(`${configKey} must exist and be readable: ${normalizedPath}`, appErrorCodes.localPathNotReadable);
  }

  if (!stats.isDirectory() && !stats.isFile()) {
    throw new ConfigurationError(`${configKey} must be a local file or directory: ${normalizedPath}`, appErrorCodes.localPathInvalidKind);
  }

  return normalizedPath;
}

function normalizeLocalPathInput(input: string): string {
  if (sep === '\\') return input;

  return input.replace(/\\ /g, ' ');
}
