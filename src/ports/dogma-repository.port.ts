import type { DogmaRefreshResult } from '#domain/dogma';

export interface DogmaRepositoryPort {
  saveRefreshResult(result: DogmaRefreshResult, outputDir?: string): Promise<readonly string[]>;
}
