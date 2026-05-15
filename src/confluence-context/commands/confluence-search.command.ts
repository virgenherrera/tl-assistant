import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { ConfluenceReaderService } from '#confluence-context/services';
import { LocalConfluenceContextRepositoryService } from '#confluence-context/adapters';
import { CONFLUENCE_OUTPUT_DIR } from '#confluence-context/providers';

interface ConfluenceSearchOptions {
  readonly limit?: number;
  readonly outputDir?: string;
  readonly noSave?: boolean;
}

@Command({
  name: 'confluence:search',
  arguments: '<query>',
  description: 'Busca páginas Confluence por texto usando CQL en modo read-only.',
})
export class ConfluenceSearchCommand extends CommandRunner {
  constructor(
    @Inject(ConfluenceReaderService) private readonly reader: ConfluenceReaderService,
    @Inject(LocalConfluenceContextRepositoryService) private readonly repository: LocalConfluenceContextRepositoryService,
    @Inject(CONFLUENCE_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {
    super();
  }

  async run(passedParams: string[], options: ConfluenceSearchOptions): Promise<void> {
    const query = passedParams.join(' ').trim();
    if (!query) throw new Error('query is required.');
    const result = await this.reader.search(query, options.limit);
    const outputFiles = options.noSave === true
      ? []
      : await this.repository.saveSearch(result, options.outputDir === undefined ? this.defaultOutputDir : toAbsoluteLocalPath(options.outputDir));

    console.log(JSON.stringify({ result, outputFiles }, null, 2));
  }

  @Option({ flags: '-l, --limit <number>', description: 'Cantidad máxima de resultados. Default: 10, max: 25.' })
  parseLimit(value: string): number {
    return Number.parseInt(value, 10);
  }

  @Option({ flags: '-o, --output-dir <path>', description: 'Directorio de salida. Default: .tl-assistant/confluence.' })
  parseOutputDir(value: string): string {
    return value;
  }

  @Option({ flags: '--no-save', description: 'No escribe artifacts locales; sólo imprime JSON.' })
  parseNoSave(): boolean {
    return true;
  }
}
