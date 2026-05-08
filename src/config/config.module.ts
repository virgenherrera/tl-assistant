import { Module } from '@nestjs/common';
import { AppConfigModule } from './app-config.module';
import { FoundationOutputConfig, FoundationDocsConfig, JiraConfig } from './configurations';
import { loadAppEnvFiles } from './env/app-env';

loadAppEnvFiles();

@Module({
  imports: [
    AppConfigModule.forRoot({
      cache: false,
      configClasses: [FoundationDocsConfig, FoundationOutputConfig, JiraConfig],
      expandVariables: true,
      isGlobal: true,
    }),
  ],
  exports: [AppConfigModule],
})
export class ConfigModule {}
