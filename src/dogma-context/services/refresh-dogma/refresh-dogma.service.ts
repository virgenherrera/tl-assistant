import { Inject, Injectable } from '@nestjs/common';
import { lastValueFrom, tap } from 'rxjs';
import type { DogmaRefreshResult } from '#domain/dogma';
import type { DogmaRefreshEvent } from '#dogma-context/domain';
import { DogmaRefreshPipelineService } from '#dogma-context/services/dogma-refresh-pipeline/dogma-refresh-pipeline.service';

export interface RefreshDogmaInput {
  readonly rootPaths: readonly string[];
  readonly outputDir?: string;
  readonly concurrency?: number;
  readonly onProgress?: (event: DogmaRefreshEvent) => void;
}

@Injectable()
export class RefreshDogmaService {
  constructor(
    @Inject(DogmaRefreshPipelineService) private readonly pipeline: DogmaRefreshPipelineService,
  ) {}

  async execute(input: RefreshDogmaInput): Promise<DogmaRefreshResult> {
    let finalResult: DogmaRefreshResult | undefined;

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
