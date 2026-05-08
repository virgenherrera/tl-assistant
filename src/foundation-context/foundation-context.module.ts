import { Module } from '@nestjs/common';
import { ConfigModule } from '#config/config.module';
import {
  DocxDocumentExtractor,
  LocalFoundationRepositoryService,
  LocalDocumentExtractorRegistry,
  LocalFoundationSourceReaderService,
  PdfDocumentExtractor,
  PlainTextDocumentExtractor,
  SpreadsheetDocumentExtractor,
  UnsupportedDocumentExtractor,
} from '#foundation-context/adapters';
import { FoundationRefreshCommand } from '#foundation-context/commands/foundation-refresh/foundation-refresh';
import {
  FoundationRefreshPipelineService,
  LocalFoundationAgentService,
  RefreshFoundationService,
  UniversalAgentContextFactoryService,
} from '#foundation-context/services';
import { foundationOutputDirProvider } from '#foundation-context/providers';

@Module({
  imports: [ConfigModule],
  providers: [
    foundationOutputDirProvider,
    FoundationRefreshCommand,
    DocxDocumentExtractor,
    FoundationRefreshPipelineService,
    LocalFoundationAgentService,
    LocalFoundationRepositoryService,
    LocalDocumentExtractorRegistry,
    LocalFoundationSourceReaderService,
    PdfDocumentExtractor,
    PlainTextDocumentExtractor,
    RefreshFoundationService,
    SpreadsheetDocumentExtractor,
    UniversalAgentContextFactoryService,
    UnsupportedDocumentExtractor,
  ],
})
export class FoundationContextModule {}
