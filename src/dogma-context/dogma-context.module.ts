import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import {
  DocxDocumentExtractor,
  LocalDogmaRepositoryService,
  LocalDocumentExtractorRegistry,
  LocalFoundationDocReaderService,
  PdfDocumentExtractor,
  PlainTextDocumentExtractor,
  SpreadsheetDocumentExtractor,
  UnsupportedDocumentExtractor,
} from '#dogma-context/adapters';
import { DogmaRefreshCommand } from '#dogma-context/commands/dogma-refresh/dogma-refresh';
import {
  DogmaRefreshPipelineService,
  LocalDogmaAgentService,
  RefreshDogmaService,
  UniversalAgentContextFactoryService,
} from '#dogma-context/services';
import { dogmaOutputDirProvider } from '#dogma-context/providers';

@Module({
  imports: [ConfigModule],
  providers: [
    dogmaOutputDirProvider,
    DogmaRefreshCommand,
    DocxDocumentExtractor,
    DogmaRefreshPipelineService,
    LocalDogmaAgentService,
    LocalDogmaRepositoryService,
    LocalDocumentExtractorRegistry,
    LocalFoundationDocReaderService,
    PdfDocumentExtractor,
    PlainTextDocumentExtractor,
    RefreshDogmaService,
    SpreadsheetDocumentExtractor,
    UniversalAgentContextFactoryService,
    UnsupportedDocumentExtractor,
  ],
})
export class DogmaContextModule {}
