import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { FoundationDocsConfig, InjectConfig, toAbsoluteLocalPath } from '#config';
import { DOGMA_OUTPUT_DIR } from '#dogma-context/providers';
import type { DogmaRefreshEvent } from '#dogma-context/domain';
import { RefreshDogmaService } from '#dogma-context/services';

interface DogmaRefreshOptions {
  readonly outputDir?: string;
  readonly progress?: boolean;
  readonly concurrency?: number;
}

@Command({
  name: 'dogma:refresh',
  description: 'Genera/regenera dogma local desde FOUNDATION_DOCS_PATH.',
})
export class DogmaRefreshCommand extends CommandRunner {
  constructor(
    @InjectConfig(FoundationDocsConfig) private readonly foundationDocsConfig: FoundationDocsConfig,
    @Inject(RefreshDogmaService) private readonly refreshDogma: RefreshDogmaService,
    @Inject(DOGMA_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {
    super();
  }

  async run(_passedParams: string[], options: DogmaRefreshOptions): Promise<void> {
    const outputDir = toAbsoluteLocalPath(options.outputDir ?? this.defaultOutputDir);
    const result = await this.refreshDogma.execute({
      rootPaths: [this.foundationDocsConfig.discoveryRootPath],
      outputDir,
      ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
      ...(options.progress === true ? { onProgress: (event) => printProgressEvent(event) } : {}),
    });

    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      briefItems: result.brief.items.length,
      outputFiles: result.outputFiles,
      agentContext: result.outputFiles.find((file) => file.endsWith('AGENT_CONTEXT.md')),
      sourceMap: result.outputFiles.find((file) => file.endsWith('source-map.json')),
      dogmaBrief: result.outputFiles.find((file) => file.endsWith('dogma-brief.md')),
    }, null, 2));
  }

  @Option({
    flags: '-o, --output-dir <path>',
    description: 'Directorio de salida para artefactos de dogma. Default: .tl-assistant/dogma.',
  })
  parseOutputDir(value: string): string {
    return value;
  }

  @Option({
    flags: '--progress',
    description: 'Imprime eventos de progreso como NDJSON para una TUI/agente consumidor.',
  })
  parseProgress(): boolean {
    return true;
  }

  @Option({
    flags: '-c, --concurrency <number>',
    description: 'Cantidad máxima de documentos procesados en paralelo.',
  })
  parseConcurrency(value: string): number {
    return Number.parseInt(value, 10);
  }
}

function printProgressEvent(event: DogmaRefreshEvent): void {
  if (event.type === 'refresh.completed') {
    console.error(JSON.stringify({ type: event.type, stats: event.stats }));
    return;
  }

  console.error(JSON.stringify(event));
}
