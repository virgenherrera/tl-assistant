import { z } from 'zod';
import { parseReadableLocalPath } from '#config/path/local-paths';

export class FoundationDocsConfig {
  readonly discoveryRootPath!: string;

  static readonly schema = z
    .object({
      FOUNDATION_DOCS_PATH: z
        .string({ error: 'FOUNDATION_DOCS_PATH is required.' })
        .trim()
        .min(1, 'FOUNDATION_DOCS_PATH cannot be empty.'),
    })
    .transform(({ FOUNDATION_DOCS_PATH }) => ({
      discoveryRootPath: parseReadableLocalPath(FOUNDATION_DOCS_PATH, 'FOUNDATION_DOCS_PATH'),
    } satisfies FoundationDocsConfig));
}
