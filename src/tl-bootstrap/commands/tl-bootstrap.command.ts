import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { TlBootstrapService } from '#tl-bootstrap/services';

interface TlBootstrapOptions {
  readonly outputDir?: string;
}

@Command({
  name: 'tl:bootstrap',
  description: 'Genera runbook operativo para que cualquier agente use los artifacts TL locales correctos.',
})
export class TlBootstrapCommand extends CommandRunner {
  constructor(@Inject(TlBootstrapService) private readonly bootstrap: TlBootstrapService) {
    super();
  }

  async run(_passedParams: string[], options: TlBootstrapOptions): Promise<void> {
    const result = await this.bootstrap.generate(options.outputDir === undefined ? undefined : toAbsoluteLocalPath(options.outputDir));
    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      outputDir: result.outputDir,
      outputFiles: result.outputFiles,
      missingRequiredArtifacts: result.missingRequiredArtifacts,
      operatingContext: result.outputFiles.find((file) => file.endsWith('OPERATING_CONTEXT.md')),
    }, null, 2));
  }

  @Option({
    flags: '-o, --output-dir <path>',
    description: 'Directorio de salida para bootstrap de agente. Default: .tl-assistant/agent.',
  })
  parseOutputDir(value: string): string {
    return value;
  }
}
