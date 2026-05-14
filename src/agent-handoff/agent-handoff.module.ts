import { Module } from '@nestjs/common';
import { AgentAuditCommand, AgentHandoffCommand } from '#agent-handoff/commands';
import { agentHandoffOutputDirProvider } from '#agent-handoff/providers';
import { AgentHandoffService } from '#agent-handoff/services';

@Module({
  providers: [agentHandoffOutputDirProvider, AgentHandoffService, AgentHandoffCommand, AgentAuditCommand],
  exports: [AgentHandoffService],
})
export class AgentHandoffModule {}
