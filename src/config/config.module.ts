import { Module } from '@nestjs/common';
import { AppConfigModule } from './app-config.module';
import { DogmaOutputConfig, FoundationDocsConfig } from './configurations';

@Module({
  imports: [
    AppConfigModule.forRoot({
      cache: false,
      configClasses: [FoundationDocsConfig, DogmaOutputConfig],
      expandVariables: true,
      isGlobal: true,
    }),
  ],
  exports: [AppConfigModule],
})
export class ConfigModule {}
