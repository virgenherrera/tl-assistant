import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { env } from 'node:process';
import { ConfigModule } from '#config/config.module';
import { JiraConfig, loadAppEnvFiles } from '#config';
import { JiraHttpClientService, LocalJiraContextRepositoryService, LocalJiraRefinementRepositoryService } from '#jira-context/adapters';
import { JiraDoctorCommand, JiraRefineCommand, JiraRefreshCommand } from '#jira-context/commands';
import { JIRA_OUTPUT_DIR, jiraFetchProvider, jiraOutputDirProvider, jiraRefinementOutputDirProvider } from '#jira-context/providers';
import {
  JiraBriefService,
  JiraCapabilityRegistrarService,
  JiraDependencyMapperService,
  JiraDoctorService,
  JiraReaderService,
  JiraRefinementService,
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
      jiraRefinementOutputDirProvider,
      JiraBriefService,
      JiraCapabilityRegistrarService,
      JiraDependencyMapperService,
      JiraDoctorService,
      JiraHttpClientService,
      JiraReaderService,
      JiraRefinementService,
      JiraRefreshService,
      LocalJiraContextRepositoryService,
      LocalJiraRefinementRepositoryService,
    ];

    return {
      module: JiraContextModule,
      imports: [ConfigModule],
      providers: [
        ...providers,
        JiraDoctorCommand,
        JiraRefineCommand,
        JiraRefreshCommand,
      ],
      exports: [
        JIRA_OUTPUT_DIR,
        JiraDoctorService,
        JiraRefinementService,
        JiraRefreshService,
        JiraReaderService,
      ],
    };
  }
}
