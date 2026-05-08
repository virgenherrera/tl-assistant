import { AppError } from '#shared/errors';

export const jiraErrorCodes = {
  notConfigured: 'JIRA_NOT_CONFIGURED',
  authFailed: 'JIRA_AUTH_FAILED',
  forbidden: 'JIRA_FORBIDDEN',
  notFound: 'JIRA_NOT_FOUND',
  rateLimited: 'JIRA_RATE_LIMITED',
  requestFailed: 'JIRA_REQUEST_FAILED',
} as const;

export type JiraErrorCode = typeof jiraErrorCodes[keyof typeof jiraErrorCodes];

export class JiraError extends AppError {
  public constructor(message: string, code: JiraErrorCode, cause?: unknown) {
    super(message, code, cause);
    this.name = 'JiraError';
  }
}
