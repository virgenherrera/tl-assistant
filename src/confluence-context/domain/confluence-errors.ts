export const confluenceErrorCodes = {
  notConfigured: 'CONFLUENCE_NOT_CONFIGURED',
  authFailed: 'CONFLUENCE_AUTH_FAILED',
  forbidden: 'CONFLUENCE_FORBIDDEN',
  notFound: 'CONFLUENCE_NOT_FOUND',
  rateLimited: 'CONFLUENCE_RATE_LIMITED',
  requestFailed: 'CONFLUENCE_REQUEST_FAILED',
} as const;

export type ConfluenceErrorCode = typeof confluenceErrorCodes[keyof typeof confluenceErrorCodes];

export class ConfluenceError extends Error {
  constructor(message: string, readonly code: ConfluenceErrorCode) {
    super(message);
    this.name = 'ConfluenceError';
  }
}
