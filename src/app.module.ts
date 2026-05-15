import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import { CapabilityModule } from '#capabilities';
import { FoundationContextModule } from '#foundation-context';
import { JiraContextModule } from '#jira-context';
import { TlBootstrapModule } from '#tl-bootstrap';
import { AgentHandoffModule } from '#agent-handoff';
import { ConfluenceContextModule } from '#confluence-context';

@Module({
  imports: [ConfigModule, CapabilityModule, FoundationContextModule, JiraContextModule.registerIfConfigured(), ConfluenceContextModule.registerIfConfigured(), TlBootstrapModule, AgentHandoffModule],
})
export class AppModule {}
