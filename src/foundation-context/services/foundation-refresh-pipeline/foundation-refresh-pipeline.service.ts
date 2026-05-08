import { Inject, Injectable } from '@nestjs/common';
import { availableParallelism } from 'node:os';
import { relative, sep } from 'node:path';
import { EMPTY, Observable, catchError, concat, from, mergeMap, of } from 'rxjs';
import type { FoundationBrief, FoundationBriefItem, FoundationExtraction, FoundationRefreshResult, FoundationSourceEntry, FoundationSourceMap } from '#domain/foundation';
import type { FoundationSource } from '#ports';
import type { FoundationRefreshEvent, FoundationRefreshStats, DocumentExtractionEvent } from '#foundation-context/domain';
import { LocalFoundationRepositoryService } from '#foundation-context/adapters';
import { LocalDocumentExtractorRegistry } from '#foundation-context/adapters';
import { LocalFoundationSourceReaderService } from '#foundation-context/adapters';
import { LocalFoundationAgentService } from '#foundation-context/services/local-foundation-agent/local-foundation-agent.service';
import { UniversalAgentContextFactoryService } from '#foundation-context/services/universal-agent-context-factory/universal-agent-context-factory.service';
import { FOUNDATION_OUTPUT_DIR } from '#foundation-context/providers';

export interface FoundationRefreshPipelineInput {
  readonly rootPaths: readonly string[];
  readonly outputDir?: string;
  readonly concurrency?: number;
}

interface PipelineSourceRuntime {
  readonly rootPath: string;
  readonly source: FoundationSource;
  readonly relativePath: string;
  readonly sourceRef: string;
}

interface PipelineState {
  readonly startedAt: number;
  readonly sourceEntries: FoundationSourceEntry[];
  readonly seenSourceRefs: Set<string>;
  readonly extractions: FoundationExtraction[];
  readonly briefItems: FoundationBriefItem[];
  discovered: number;
  processed: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class FoundationRefreshPipelineService {
  constructor(
    @Inject(LocalFoundationSourceReaderService) private readonly foundationDocReader: LocalFoundationSourceReaderService,
    @Inject(LocalDocumentExtractorRegistry) private readonly extractorRegistry: LocalDocumentExtractorRegistry,
    @Inject(LocalFoundationAgentService) private readonly agentRuntime: LocalFoundationAgentService,
    @Inject(UniversalAgentContextFactoryService) private readonly agentContextFactory: UniversalAgentContextFactoryService,
    @Inject(LocalFoundationRepositoryService) private readonly foundationRepository: LocalFoundationRepositoryService,
    @Inject(FOUNDATION_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {}

  refresh(input: FoundationRefreshPipelineInput): Observable<FoundationRefreshEvent> {
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

    return new Observable<FoundationRefreshEvent>((subscriber) => {
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
              of({ type: 'source.discovered', source: runtimeSource.source, discovered: state.discovered } satisfies FoundationRefreshEvent),
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

  private processSource(runtimeSource: PipelineSourceRuntime, state: PipelineState): Observable<FoundationRefreshEvent> {
    const extractor = this.extractorRegistry.extractorFor(runtimeSource.source);

    return extractor.extract(runtimeSource.source).pipe(
      mergeMap((event) => this.mapExtractionEvent(event, runtimeSource, state)),
      catchError((error: unknown) => {
        state.failed += 1;
        state.sourceEntries.push(toSourceEntry(runtimeSource, 'failed', errorToMessage(error)));
        return of({ type: 'source.failed', source: runtimeSource.source, error: errorToMessage(error) } satisfies FoundationRefreshEvent);
      }),
    );
  }

  private mapExtractionEvent(
    event: DocumentExtractionEvent,
    runtimeSource: PipelineSourceRuntime,
    state: PipelineState,
  ): Observable<FoundationRefreshEvent> {
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
    } satisfies FoundationRefreshEvent;

    return concat(
      of(extractedEvent),
      from(this.agentRuntime.readForFoundation({
        sourceRef: runtimeSource.sourceRef,
        relativePath: runtimeSource.relativePath,
        rawContent: event.text,
      })).pipe(
        mergeMap((agentResult) => {
          state.briefItems.push(...agentResult.items);
          return from(
            agentResult.items.map((item) => ({
              type: 'foundation.brief-item.created',
              source: event.source,
              item: {
                id: item.id,
                kind: item.kind,
                title: item.title,
                sourceRefs: item.sourceRefs,
              },
            }) satisfies FoundationRefreshEvent),
          );
        }),
      ),
    );
  }

  private async completeRefresh(input: FoundationRefreshPipelineInput, state: PipelineState): Promise<FoundationRefreshEvent> {
    const generatedAt = new Date().toISOString();
    const sourceMap: FoundationSourceMap = {
      schemaVersion: 'tl-assistant.foundation-source-map.v1',
      generatedAt,
      sourceRefs: ['foundation.local'],
      sources: state.sourceEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    };
    const brief: FoundationBrief = {
      schemaVersion: 'tl-assistant.foundation-brief.v1',
      generatedAt,
      summary: summarizeBrief(state.briefItems, sourceMap.sources),
      items: state.briefItems,
    };
    const resultWithoutOutputFiles: FoundationRefreshResult = {
      generatedAt,
      sourceMap,
      extractions: state.extractions,
      brief,
      agentContext: this.agentContextFactory.create({ generatedAt }),
      outputFiles: [],
    };
    const outputFiles = await this.foundationRepository.saveRefreshResult(resultWithoutOutputFiles, input.outputDir ?? this.defaultOutputDir);
    const result = { ...resultWithoutOutputFiles, outputFiles };
    const stats: FoundationRefreshStats = {
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

function toPipelineSource(rootPath: string, source: FoundationSource): PipelineSourceRuntime {
  const relativePath = toPortableRelativePath(relative(rootPath, source.path));
  return {
    rootPath,
    source,
    relativePath,
    sourceRef: `foundation://local/${relativePath}`,
  };
}

function toSourceEntry(runtimeSource: PipelineSourceRuntime, status: FoundationSourceEntry['status'], error?: string): FoundationSourceEntry {
  return {
    kind: runtimeSource.source.kind,
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

function summarizeBrief(items: readonly FoundationBriefItem[], sources: readonly FoundationSourceEntry[]): string {
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
