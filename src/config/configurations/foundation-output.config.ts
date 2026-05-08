import { z } from 'zod';
import { toAbsoluteLocalPath } from '#config/path/local-paths';

export class FoundationOutputConfig {
  readonly outputDir!: string;

  static readonly schema = z
    .object({
      FOUNDATION_OUTPUT_DIR: z.string().trim().min(1, 'FOUNDATION_OUTPUT_DIR cannot be empty.').optional(),
    })
    .transform(({ FOUNDATION_OUTPUT_DIR }) => ({
      outputDir: toAbsoluteLocalPath(FOUNDATION_OUTPUT_DIR ?? '.tl-assistant/foundation'),
    } satisfies FoundationOutputConfig));
}
