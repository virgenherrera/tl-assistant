import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { FoundationDocsConfig, InjectConfig, toAbsoluteLocalPath } from '#config';
import { FOUNDATION_OUTPUT_DIR } from '#foundation-context/providers';
import { ConfigurationError, appErrorCodes } from '#shared/errors';
import type { FoundationRefreshEvent } from '#foundation-context/domain';
import { RefreshFoundationService } from '#foundation-context/services';

interface FoundationRefreshOptions {
  readonly outputDir?: string;
  readonly progress?: boolean;
  readonly concurrency?: number;
}

@Command({
  name: 'foundation:refresh',
  description: 'Genera/regenera foundation local desde FOUNDATION_DOCS_PATH.',
})
export class FoundationRefreshCommand extends CommandRunner {
  constructor(
    @InjectConfig(FoundationDocsConfig) private readonly foundationDocsConfig: FoundationDocsConfig,
    @Inject(RefreshFoundationService) private readonly refreshFoundation: RefreshFoundationService,
    @Inject(FOUNDATION_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {
    super();
  }

  async run(_passedParams: string[], options: FoundationRefreshOptions): Promise<void> {
    const discoveryRootPath = requireFoundationDiscoveryRootPath(this.foundationDocsConfig);
    const outputDir = toAbsoluteLocalPath(options.outputDir ?? this.defaultOutputDir);
    const result = await this.refreshFoundation.execute({
      rootPaths: [discoveryRootPath],
      outputDir,
      ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
      ...(options.progress === true ? { onProgress: (event) => printProgressEvent(event) } : {}),
    });

    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      briefItems: result.brief.items.length,
      outputFiles: result.outputFiles,
      agentContext: result.outputFiles.find((file) => file.endsWith('AGENT_FOUNDATION_CONTEXT.md')),
      sourceMap: result.outputFiles.find((file) => file.endsWith('source-map.json')),
      foundationBrief: result.outputFiles.find((file) => file.endsWith('foundation-brief.md')),
    }, null, 2));
  }

  @Option({
    flags: '-o, --output-dir <path>',
    description: 'Directorio de salida para artefactos de foundation. Default: .tl-assistant/foundation.',
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

function printProgressEvent(event: FoundationRefreshEvent): void {
  if (event.type === 'refresh.completed') {
    console.error(JSON.stringify({ type: event.type, stats: event.stats }));
    return;
  }

  console.error(JSON.stringify(event));
}

function requireFoundationDiscoveryRootPath(config: FoundationDocsConfig): string {
  if (config.configured && config.discoveryRootPath) return config.discoveryRootPath;

  throw new ConfigurationError(
    'foundation.local is not configured. Set FOUNDATION_DOCS_PATH before running foundation:refresh.',
    appErrorCodes.foundationSourceNotConfigured,
  );
}
