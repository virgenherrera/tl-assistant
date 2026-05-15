import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { ConfluenceReaderService } from '#confluence-context/services';
import { LocalConfluenceContextRepositoryService } from '#confluence-context/adapters';
import { CONFLUENCE_OUTPUT_DIR } from '#confluence-context/providers';

interface ConfluencePageOptions {
  readonly outputDir?: string;
  readonly noSave?: boolean;
}

@Command({
  name: 'confluence:page',
  arguments: '<pageId>',
  description: 'Lee una página Confluence por pageId en modo read-only y guarda artifact local.',
})
export class ConfluencePageCommand extends CommandRunner {
  constructor(
    @Inject(ConfluenceReaderService) private readonly reader: ConfluenceReaderService,
    @Inject(LocalConfluenceContextRepositoryService) private readonly repository: LocalConfluenceContextRepositoryService,
    @Inject(CONFLUENCE_OUTPUT_DIR) private readonly defaultOutputDir: string,
  ) {
    super();
  }

  async run(passedParams: string[], options: ConfluencePageOptions): Promise<void> {
    const [pageId] = passedParams;
    if (!pageId) throw new Error('pageId is required.');
    const page = await this.reader.getPage(pageId);
    const outputFiles = options.noSave === true
      ? []
      : await this.repository.savePage(page, options.outputDir === undefined ? this.defaultOutputDir : toAbsoluteLocalPath(options.outputDir));

    console.log(JSON.stringify({ page, outputFiles }, null, 2));
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
