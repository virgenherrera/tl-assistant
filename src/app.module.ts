import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import { CapabilityModule } from '#capabilities';
import { FoundationContextModule } from '#foundation-context';
import { JiraContextModule } from '#jira-context';
import { TlBootstrapModule } from '#tl-bootstrap';
import { AgentHandoffModule } from '#agent-handoff';

@Module({
  imports: [ConfigModule, CapabilityModule, FoundationContextModule, JiraContextModule.registerIfConfigured(), TlBootstrapModule, AgentHandoffModule],
})
export class AppModule {}
