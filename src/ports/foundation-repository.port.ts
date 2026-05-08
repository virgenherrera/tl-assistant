import type { FoundationRefreshResult } from '#domain/foundation';

export interface FoundationRepositoryPort {
  saveRefreshResult(result: FoundationRefreshResult, outputDir?: string): Promise<readonly string[]>;
}
