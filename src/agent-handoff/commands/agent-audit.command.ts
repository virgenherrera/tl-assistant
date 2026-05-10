import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { toAbsoluteLocalPath } from '#config';
import { AgentHandoffService } from '#agent-handoff/services';

interface AgentAuditOptions { readonly nonStrict?: boolean }

@Command({
  name: 'agent:audit',
  arguments: '<runPath>',
  description: 'Audita un agent handoff sandbox contra su AUDIT_BASELINE.json.',
})
export class AgentAuditCommand extends CommandRunner {
  constructor(@Inject(AgentHandoffService) private readonly handoff: AgentHandoffService) {
    super();
  }

  async run(passedParams: string[], options: AgentAuditOptions): Promise<void> {
    const runPath = requireRunPath(passedParams);
    const report = await this.handoff.audit({ runPath: toAbsoluteLocalPath(runPath), strict: options.nonStrict !== true });
    console.log(JSON.stringify(report, null, 2));
  }

  @Option({ flags: '--non-strict', description: 'Convierte algunas fallas de presupuesto/output en warnings.' })
  parseNonStrict(): boolean { return true; }
}

function requireRunPath(passedParams: readonly string[]): string {
  const runPath = passedParams.find((param) => !param.startsWith('-'))?.trim();
  if (!runPath) throw new TypeError('agent:audit requires a run path. Example: agent:audit .tl-assistant/agent-runs/OTPSMT-1422');
  return runPath;
}
