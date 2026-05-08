import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import { CapabilityModule } from '#capabilities';
import { DogmaContextModule } from '#dogma-context';
import { JiraContextModule } from '#jira-context';

@Module({
  imports: [ConfigModule, CapabilityModule, DogmaContextModule, JiraContextModule.registerIfConfigured()],
})
export class AppModule {}
