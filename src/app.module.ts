import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import { CapabilityModule } from '#capabilities';
import { FoundationContextModule } from '#foundation-context';
import { JiraContextModule } from '#jira-context';

@Module({
  imports: [ConfigModule, CapabilityModule, FoundationContextModule, JiraContextModule.registerIfConfigured()],
})
export class AppModule {}
