import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { JiraRefinementService } from '#jira-context/services';

interface JiraRefineOptions {
  readonly source?: readonly string[];
  readonly outputDir?: string;
}

@Command({
  name: 'jira:refine',
  arguments: '<issueKey>',
  description: 'Genera un workspace local descartable para refinar una historia Jira con evidencia read-only.',
})
export class JiraRefineCommand extends CommandRunner {
  constructor(@Inject(JiraRefinementService) private readonly refinement: JiraRefinementService) {
    super();
  }

  async run(passedParams: string[], options: JiraRefineOptions): Promise<void> {
    const issueKey = requireIssueKey(passedParams);
    const result = await this.refinement.refine({
      issueKey,
      sourcePaths: extractSourcePaths(passedParams, options.source ?? []),
      ...(options.outputDir === undefined ? {} : { outputDir: toAbsoluteLocalPath(options.outputDir) }),
    });

    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      issueKey: result.issueKey,
      outputDir: result.outputDir,
      linkedIssues: result.evidence.linkedIssues.length,
      sources: result.evidence.sources.length,
      outputFiles: result.outputFiles,
      refinement: result.outputFiles.find((file) => file.endsWith('refinement.md')),
      agentPrompt: result.outputFiles.find((file) => file.endsWith('agent-prompt.md')),
      evidence: result.outputFiles.find((file) => file.endsWith('evidence.json')),
    }, null, 2));
  }

  @Option({
    flags: '-s, --source <path>',
    description: 'Archivo local de evidencia extra; puede repetirse. Ej: --source ./contract.md',
  })
  parseSource(value: string, previous: string[] = []): string[] {
    return [...previous, value];
  }

  @Option({
    flags: '-o, --output-dir <path>',
    description: 'Directorio raíz de salida. Default: .tl-assistant/refinement.',
  })
  parseOutputDir(value: string): string {
    return value;
  }
}

function requireIssueKey(passedParams: readonly string[]): string {
  const issueKey = passedParams.find((param) => !param.startsWith('-'))?.trim();
  if (!issueKey) throw new TypeError('jira:refine requires an issue key. Example: jira:refine OTPSMT-1422');
  return issueKey;
}

function extractSourcePaths(passedParams: readonly string[], optionSources: readonly string[]): readonly string[] {
  const sources = [...optionSources];

  for (let index = 0; index < passedParams.length; index += 1) {
    const param = passedParams[index];
    if (param === '--source' || param === '-s') {
      const sourcePath = passedParams[index + 1];
      if (sourcePath !== undefined) sources.push(sourcePath);
      index += 1;
      continue;
    }

    if (param?.startsWith('--source=')) {
      sources.push(param.slice('--source='.length));
    }
  }

  return [...new Set(sources)];
}
