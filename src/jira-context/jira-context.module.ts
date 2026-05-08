import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { env } from 'node:process';
import { ConfigModule } from '#config/config.module';
import { JiraConfig, loadAppEnvFiles } from '#config';
import { JiraHttpClientService, LocalJiraContextRepositoryService } from '#jira-context/adapters';
import { JiraDoctorCommand, JiraRefreshCommand } from '#jira-context/commands';
import { JIRA_OUTPUT_DIR, jiraFetchProvider, jiraOutputDirProvider } from '#jira-context/providers';
import {
  JiraBriefService,
  JiraCapabilityRegistrarService,
  JiraDependencyMapperService,
  JiraDoctorService,
  JiraReaderService,
  JiraRefreshService,
} from '#jira-context/services';

@Module({})
export class JiraContextModule {
  static registerIfConfigured(): DynamicModule {
    loadAppEnvFiles();
    if (!JiraConfig.isConfiguredEnv(env)) {
      return { module: JiraContextModule };
    }

    const providers: Provider[] = [
      jiraFetchProvider,
      jiraOutputDirProvider,
      JiraBriefService,
      JiraCapabilityRegistrarService,
      JiraDependencyMapperService,
      JiraDoctorService,
      JiraHttpClientService,
      JiraReaderService,
      JiraRefreshService,
      LocalJiraContextRepositoryService,
    ];

    return {
      module: JiraContextModule,
      imports: [ConfigModule],
      providers: [
        ...providers,
        JiraDoctorCommand,
        JiraRefreshCommand,
      ],
      exports: [
        JIRA_OUTPUT_DIR,
        JiraDoctorService,
        JiraRefreshService,
        JiraReaderService,
      ],
    };
  }
}
