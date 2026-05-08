import { Option, Command, CommandRunner } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { JiraRefreshService } from '#jira-context/services';

interface JiraRefreshOptions {
  readonly outputDir?: string;
}

@Command({
  name: 'jira:refresh',
  description: 'Genera contexto local read-only de Jira para agentes TL.',
})
export class JiraRefreshCommand extends CommandRunner {
  constructor(private readonly refreshService: JiraRefreshService) {
    super();
  }

  async run(_passedParams: string[], options: JiraRefreshOptions): Promise<void> {
    const result = await this.refreshService.refresh(options.outputDir === undefined ? undefined : toAbsoluteLocalPath(options.outputDir));
    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      board: result.board,
      sprints: result.sprints.length,
      issues: result.issues.length,
      dependencyEdges: result.dependencies.edges.length,
      outputFiles: result.outputFiles,
      agentContext: result.outputFiles.find((file) => file.endsWith('AGENT_JIRA_CONTEXT.md')),
      tlBrief: result.outputFiles.find((file) => file.endsWith('tl-brief.md')),
    }, null, 2));
  }

  @Option({
    flags: '-o, --output-dir <path>',
    description: 'Directorio de salida para artifacts Jira. Default: .tl-assistant/jira.',
  })
  parseOutputDir(value: string): string {
    return value;
  }
}
