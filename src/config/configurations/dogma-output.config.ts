import { z } from 'zod';
import { toAbsoluteLocalPath } from '#config/path/local-paths';

export class DogmaOutputConfig {
  readonly outputDir!: string;

  static readonly schema = z
    .object({
      DOGMA_OUTPUT_DIR: z.string().trim().min(1, 'DOGMA_OUTPUT_DIR cannot be empty.').optional(),
    })
    .transform(({ DOGMA_OUTPUT_DIR }) => ({
      outputDir: toAbsoluteLocalPath(DOGMA_OUTPUT_DIR ?? '.tl-assistant/dogma'),
    } satisfies DogmaOutputConfig));
}
