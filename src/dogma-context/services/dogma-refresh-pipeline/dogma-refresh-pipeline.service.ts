import { Inject, Injectable } from '@nestjs/common';
import { availableParallelism } from 'node:os';
import { relative, sep } from 'node:path';
import { EMPTY, Observable, catchError, concat, from, mergeMap, of } from 'rxjs';
import type { DogmaBrief, DogmaBriefItem, DogmaExtraction, DogmaRefreshResult, DogmaSourceEntry, DogmaSourceMap } from '#domain/dogma';
import type { FoundationDocSource } from '#ports';
import type { DogmaRefreshEvent, DogmaRefreshStats, DocumentExtractionEvent } from '#dogma-context/domain';
import { LocalDogmaRepositoryService } from '#dogma-context/adapters';
import { LocalDocumentExtractorRegistry } from '#dogma-context/adapters';
import { LocalFoundationDocReaderService } from '#dogma-context/adapters';
import { LocalDogmaAgentService } from '#dogma-context/services/local-dogma-agent/local-dogma-agent.service';
import { UniversalAgentContextFactoryService } from '#dogma-context/services/universal-agent-context-factory/universal-agent-context-factory.service';
import { DOGMA_OUTPUT_DIR } from '#dogma-context/providers';

export interface DogmaRefreshPipelineInput {
  readonly rootPaths: readonly string[];
  readonly outputDir?: string;
  readonly concurrency?: number;
}

interface PipelineSourceRuntime {
  readonly rootPath: string;
  readonly source: FoundationDocSource;
  readonly relativePath: string;
  readonly sourceRef: string;
}

interface PipelineState {
  readonly startedAt: number;
  readonly sourceEntries: DogmaSourceEntry[];
  readonly seenSourceRefs: Set<string>;
  readonly extractions: DogmaExtraction[];
  readonly briefItems: DogmaBriefItem[];
  discovered: number;
  processed: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class DogmaRefreshPipelineService {
  constructor(
    @Inject(LocalFoundationDocReaderService) private readonly foundationDocReader: LocalFoundationDocReaderService,
    @Inject(LocalDocumentExtractorRegistry) private readonly extractorRegistry: LocalDocumentExtractorRegistry,
    @Inject(LocalDogmaAgentService) private readonly agentRuntime: LocalDogmaAgentService,
    @Inject(UniversalAgentContextFactoryService) private readonly agentContextFactory: UniversalAgentContextFactoryService,
    @Inject(LocalDogmaRepositoryService) private readonly dogmaRepository: LocalDogmaRepositoryService,
    @Inject(DOGMA_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {}

  refresh(input: DogmaRefreshPipelineInput): Observable<DogmaRefreshEvent> {
    const state: PipelineState = {
      startedAt: Date.now(),
      sourceEntries: [],
      seenSourceRefs: new Set<string>(),
      extractions: [],
      briefItems: [],
      discovered: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
    };
    const concurrency = normalizeConcurrency(input.concurrency);

    return new Observable<DogmaRefreshEvent>((subscriber) => {
      subscriber.next({ type: 'discovery.started', rootPaths: input.rootPaths });

      const subscription = from(input.rootPaths)
        .pipe(
          mergeMap((rootPath) => this.foundationDocReader.discoverSources$(rootPath).pipe(
            mergeMap((source) => of(toPipelineSource(rootPath, source))),
          )),
          mergeMap((runtimeSource) => {
            if (state.seenSourceRefs.has(runtimeSource.sourceRef)) return EMPTY;

            state.seenSourceRefs.add(runtimeSource.sourceRef);
            state.discovered += 1;

            return concat(
              of({ type: 'source.discovered', source: runtimeSource.source, discovered: state.discovered } satisfies DogmaRefreshEvent),
              this.processSource(runtimeSource, state),
            );
          }, concurrency),
        )
        .subscribe({
          next: (event) => subscriber.next(event),
          error: (error: unknown) => subscriber.error(error),
          complete: () => {
            void this.completeRefresh(input, state)
              .then((event) => {
                subscriber.next(event);
                subscriber.complete();
              })
              .catch((error: unknown) => subscriber.error(error));
          },
        });

      return () => subscription.unsubscribe();
    });
  }

  private processSource(runtimeSource: PipelineSourceRuntime, state: PipelineState): Observable<DogmaRefreshEvent> {
    const extractor = this.extractorRegistry.extractorFor(runtimeSource.source);

    return extractor.extract(runtimeSource.source).pipe(
      mergeMap((event) => this.mapExtractionEvent(event, runtimeSource, state)),
      catchError((error: unknown) => {
        state.failed += 1;
        state.sourceEntries.push(toSourceEntry(runtimeSource, 'failed', errorToMessage(error)));
        return of({ type: 'source.failed', source: runtimeSource.source, error: errorToMessage(error) } satisfies DogmaRefreshEvent);
      }),
    );
  }

  private mapExtractionEvent(
    event: DocumentExtractionEvent,
    runtimeSource: PipelineSourceRuntime,
    state: PipelineState,
  ): Observable<DogmaRefreshEvent> {
    if (event.type === 'read.started') {
      return of({ type: 'source.read.started', source: event.source });
    }

    if (event.type === 'read.progress') {
      return of({
        type: 'source.read.progress',
        source: event.source,
        bytesRead: event.bytesRead,
        ...(event.totalBytes === undefined ? {} : { totalBytes: event.totalBytes }),
      });
    }

    if (event.type === 'skipped') {
      state.skipped += 1;
      state.sourceEntries.push(toSourceEntry(runtimeSource, 'skipped', event.reason));
      return of({ type: 'source.skipped', source: event.source, reason: event.reason });
    }

    state.processed += 1;
    state.sourceEntries.push(toSourceEntry(runtimeSource, 'extracted'));
    state.extractions.push({
      sourceRef: runtimeSource.sourceRef,
      relativePath: runtimeSource.relativePath,
      text: event.text,
      characters: event.text.length,
    });

    const extractedEvent = {
      type: 'source.extracted',
      source: event.source,
      characters: event.text.length,
    } satisfies DogmaRefreshEvent;

    return concat(
      of(extractedEvent),
      from(this.agentRuntime.readForDogma({
        sourceRef: runtimeSource.sourceRef,
        relativePath: runtimeSource.relativePath,
        rawContent: event.text,
      })).pipe(
        mergeMap((agentResult) => {
          state.briefItems.push(...agentResult.items);
          return from(
            agentResult.items.map((item) => ({
              type: 'dogma.brief-item.created',
              source: event.source,
              item: {
                id: item.id,
                kind: item.kind,
                title: item.title,
                sourceRefs: item.sourceRefs,
              },
            }) satisfies DogmaRefreshEvent),
          );
        }),
      ),
    );
  }

  private async completeRefresh(input: DogmaRefreshPipelineInput, state: PipelineState): Promise<DogmaRefreshEvent> {
    const generatedAt = new Date().toISOString();
    const sourceMap: DogmaSourceMap = {
      schemaVersion: 'tl-assistant.source-map.v1',
      generatedAt,
      sourceRootRef: 'FOUNDATION_DOCS_PATH',
      sources: state.sourceEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    };
    const brief: DogmaBrief = {
      schemaVersion: 'tl-assistant.dogma-brief.v1',
      generatedAt,
      summary: summarizeBrief(state.briefItems, sourceMap.sources),
      items: state.briefItems,
    };
    const resultWithoutOutputFiles: DogmaRefreshResult = {
      generatedAt,
      sourceMap,
      extractions: state.extractions,
      brief,
      agentContext: this.agentContextFactory.create({ generatedAt }),
      outputFiles: [],
    };
    const outputFiles = await this.dogmaRepository.saveRefreshResult(resultWithoutOutputFiles, input.outputDir ?? this.defaultOutputDir);
    const result = { ...resultWithoutOutputFiles, outputFiles };
    const stats: DogmaRefreshStats = {
      discovered: state.discovered,
      processed: state.processed,
      skipped: state.skipped,
      failed: state.failed,
      briefItems: state.briefItems.length,
      durationMs: Date.now() - state.startedAt,
    };

    return { type: 'refresh.completed', result, stats };
  }
}

function toPipelineSource(rootPath: string, source: FoundationDocSource): PipelineSourceRuntime {
  const relativePath = toPortableRelativePath(relative(rootPath, source.path));
  return {
    rootPath,
    source,
    relativePath,
    sourceRef: `foundation://${relativePath}`,
  };
}

function toSourceEntry(runtimeSource: PipelineSourceRuntime, status: DogmaSourceEntry['status'], error?: string): DogmaSourceEntry {
  return {
    ref: runtimeSource.sourceRef,
    relativePath: runtimeSource.relativePath,
    extension: runtimeSource.source.extension,
    ...(runtimeSource.source.size === undefined ? {} : { size: runtimeSource.source.size }),
    ...(runtimeSource.source.mtimeMs === undefined ? {} : { mtimeMs: runtimeSource.source.mtimeMs }),
    status,
    ...(error === undefined ? {} : { error }),
  };
}

function toPortableRelativePath(input: string): string {
  return input.split(sep).join('/');
}

function summarizeBrief(items: readonly DogmaBriefItem[], sources: readonly DogmaSourceEntry[]): string {
  return `Generated ${items.length} brief item(s) from ${sources.length} foundation source(s). Use sourceRefs to inspect local-only raw extractions when needed.`;
}

function normalizeConcurrency(inputConcurrency: number | undefined): number {
  if (inputConcurrency !== undefined && Number.isInteger(inputConcurrency) && inputConcurrency > 0) {
    return inputConcurrency;
  }

  return Math.max(1, Math.min(4, availableParallelism() - 1));
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
