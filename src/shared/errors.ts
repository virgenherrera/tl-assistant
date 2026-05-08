export const appErrorCodes = {
  configurationInvalid: 'CONFIGURATION_INVALID',
  envVarMissing: 'ENV_VAR_MISSING',
  localPathNotReadable: 'LOCAL_PATH_NOT_READABLE',
  localPathInvalidKind: 'LOCAL_PATH_INVALID_KIND',
  agentRuntimeFailed: 'AGENT_RUNTIME_FAILED',
  foundationSourceNotConfigured: 'FOUNDATION_SOURCE_NOT_CONFIGURED',
  jiraNotConfigured: 'JIRA_NOT_CONFIGURED',
  jiraAuthFailed: 'JIRA_AUTH_FAILED',
  jiraForbidden: 'JIRA_FORBIDDEN',
  jiraNotFound: 'JIRA_NOT_FOUND',
  jiraRateLimited: 'JIRA_RATE_LIMITED',
  jiraRequestFailed: 'JIRA_REQUEST_FAILED',
} as const;

export type AppErrorCode = typeof appErrorCodes[keyof typeof appErrorCodes];

export class AppError extends Error {
  public override readonly cause?: unknown;

  public constructor(
    message: string,
    public readonly code: AppErrorCode,
    cause?: unknown,
  ) {
    super(message);
    this.cause = cause;
    this.name = 'AppError';
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string, code: AppErrorCode = appErrorCodes.configurationInvalid, cause?: unknown) {
    super(message, code, cause);
    this.name = 'ConfigurationError';
  }
}

export class AgentRuntimeError extends AppError {
  public constructor(message: string, cause?: unknown) {
    super(message, appErrorCodes.agentRuntimeFailed, cause);
    this.name = 'AgentRuntimeError';
  }
}
