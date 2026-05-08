import { Inject, Injectable } from '@nestjs/common';
import { lastValueFrom, tap } from 'rxjs';
import type { FoundationRefreshResult } from '#domain/foundation';
import type { FoundationRefreshEvent } from '#foundation-context/domain';
import { FoundationRefreshPipelineService } from '#foundation-context/services/foundation-refresh-pipeline/foundation-refresh-pipeline.service';

export interface RefreshFoundationInput {
  readonly rootPaths: readonly string[];
  readonly outputDir?: string;
  readonly concurrency?: number;
  readonly onProgress?: (event: FoundationRefreshEvent) => void;
}

@Injectable()
export class RefreshFoundationService {
  constructor(
    @Inject(FoundationRefreshPipelineService) private readonly pipeline: FoundationRefreshPipelineService,
  ) {}

  async execute(input: RefreshFoundationInput): Promise<FoundationRefreshResult> {
    let finalResult: FoundationRefreshResult | undefined;

    await lastValueFrom(
      this.pipeline.refresh(input).pipe(
        tap((event) => {
          input.onProgress?.(event);
          if (event.type === 'refresh.completed') finalResult = event.result;
        }),
      ),
    );

    if (finalResult === undefined) {
      throw new Error('El refresh dogmático terminó sin resultado final.');
    }

    return finalResult;
  }
}
