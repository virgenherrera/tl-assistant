import { z } from 'zod';
import { toAbsoluteLocalPath } from '#config/path/local-paths';

export class FoundationDocsConfig {
  readonly configured!: boolean;
  readonly discoveryRootPath?: string;

  static readonly schema = z
    .object({
      FOUNDATION_DOCS_PATH: z
        .string()
        .trim()
        .min(1, 'FOUNDATION_DOCS_PATH cannot be empty.')
        .optional(),
    })
    .transform(({ FOUNDATION_DOCS_PATH }) => {
      if (FOUNDATION_DOCS_PATH === undefined) {
        return { configured: false } satisfies FoundationDocsConfig;
      }

      return {
        configured: true,
        discoveryRootPath: toAbsoluteLocalPath(FOUNDATION_DOCS_PATH),
      } satisfies FoundationDocsConfig;
    });
}
