import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { env } from 'node:process';
import { ConfigModule } from '#config/config.module';
import { ConfluenceConfig, loadAppEnvFiles } from '#config';
import { ConfluenceHttpClientService, LocalConfluenceContextRepositoryService } from '#confluence-context/adapters';
import { ConfluenceDoctorCommand, ConfluencePageCommand, ConfluenceSearchCommand } from '#confluence-context/commands';
import { confluenceFetchProvider, confluenceOutputDirProvider } from '#confluence-context/providers';
import { ConfluenceCapabilityRegistrarService, ConfluenceReaderService } from '#confluence-context/services';

@Module({})
export class ConfluenceContextModule {
  static registerIfConfigured(): DynamicModule {
    loadAppEnvFiles();
    if (!ConfluenceConfig.isConfiguredEnv(env)) {
      return { module: ConfluenceContextModule };
    }

    const providers: Provider[] = [
      confluenceFetchProvider,
      confluenceOutputDirProvider,
      ConfluenceCapabilityRegistrarService,
      ConfluenceHttpClientService,
      ConfluenceReaderService,
      LocalConfluenceContextRepositoryService,
    ];

    return {
      module: ConfluenceContextModule,
      imports: [ConfigModule],
      providers: [
        ...providers,
        ConfluenceDoctorCommand,
        ConfluencePageCommand,
        ConfluenceSearchCommand,
      ],
      exports: [ConfluenceReaderService],
    };
  }
}
