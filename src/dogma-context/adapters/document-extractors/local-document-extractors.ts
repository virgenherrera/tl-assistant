import { Inject, Injectable } from '@nestjs/common';
import { createReadStream, type ReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { Observable, defer, map, of, startWith } from 'rxjs';
import type { DocumentExtractionEvent } from '#dogma-context/domain';
import type { DocumentExtractorPort } from '#ports';
import type { FoundationDocSource } from '#ports';

const plainTextExtensions = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.tsv', '.log']);
const spreadsheetExtensions = new Set(['.xlsx', '.xls', '.xlsm']);
const wordExtensions = new Set(['.docx']);
const pdfExtensions = new Set(['.pdf']);
const skippedVideoExtensions = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg']);
const audioExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac']);

@Injectable()
export class PlainTextDocumentExtractor implements DocumentExtractorPort {
  canHandle(source: FoundationDocSource): boolean {
    return plainTextExtensions.has(source.extension);
  }

  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent> {
    return new Observable<DocumentExtractionEvent>((subscriber) => {
      let bytesRead = 0;
      const chunks: string[] = [];
      let stream: ReadStream | undefined;

      stat(source.path)
        .then((sourceStat) => {
          subscriber.next({ type: 'read.started', source });

          stream = createReadStream(source.path, { encoding: 'utf8', highWaterMark: 64 * 1024 });

          stream.on('data', (chunk) => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            bytesRead += Buffer.byteLength(text, 'utf8');
            chunks.push(text);
            subscriber.next({ type: 'read.progress', source, bytesRead, totalBytes: sourceStat.size });
          });

          stream.on('error', (error) => subscriber.error(error));
          stream.on('end', () => {
            subscriber.next({ type: 'extracted', source, text: chunks.join('').trim() });
            subscriber.complete();
          });
        })
        .catch((error: unknown) => subscriber.error(error));

      return () => stream?.destroy();
    });
  }
}

@Injectable()
export class DocxDocumentExtractor implements DocumentExtractorPort {
  canHandle(source: FoundationDocSource): boolean {
    return wordExtensions.has(source.extension);
  }

  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent> {
    return defer(async () => {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ path: source.path });
      const messages = result.messages.length > 0
        ? `\n\n[Mensajes del parser DOCX]\n${result.messages.map((message) => `- ${message.type}: ${message.message}`).join('\n')}`
        : '';
      return `${result.value.trim()}${messages}`.trim();
    }).pipe(
      map((text) => ({ type: 'extracted', source, text }) satisfies DocumentExtractionEvent),
      startWith({ type: 'read.started', source } satisfies DocumentExtractionEvent),
    );
  }
}

@Injectable()
export class SpreadsheetDocumentExtractor implements DocumentExtractorPort {
  canHandle(source: FoundationDocSource): boolean {
    return spreadsheetExtensions.has(source.extension);
  }

  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent> {
    return defer(async () => {
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.readFile(source.path, { cellDates: true });
      return workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return `# Hoja: ${sheetName}\n\n[Hoja vacía o ilegible]`;

        const csv = XLSX.default.utils.sheet_to_csv(worksheet, { blankrows: false });
        return `# Hoja: ${sheetName}\n\n${csv.trim()}`.trim();
      }).join('\n\n').trim();
    }).pipe(
      map((text) => ({ type: 'extracted', source, text }) satisfies DocumentExtractionEvent),
      startWith({ type: 'read.started', source } satisfies DocumentExtractionEvent),
    );
  }
}

@Injectable()
export class PdfDocumentExtractor implements DocumentExtractorPort {
  canHandle(source: FoundationDocSource): boolean {
    return pdfExtensions.has(source.extension);
  }

  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent> {
    return defer(async () => {
      const data = await readFile(source.path);
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data });

      try {
        const result = await parser.getText();
        return result.text.trim();
      } finally {
        await parser.destroy();
      }
    }).pipe(
      map((text) => ({ type: 'extracted', source, text }) satisfies DocumentExtractionEvent),
      startWith({ type: 'read.started', source } satisfies DocumentExtractionEvent),
    );
  }
}

@Injectable()
export class UnsupportedDocumentExtractor implements DocumentExtractorPort {
  canHandle(): boolean {
    return true;
  }

  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent> {
    if (skippedVideoExtensions.has(source.extension) || audioExtensions.has(source.extension)) {
      return of({ type: 'skipped', source, reason: `Tipo audiovisual ignorado en v1: ${source.extension}` });
    }

    if (imageExtensions.has(source.extension)) {
      return new Observable<DocumentExtractionEvent>((subscriber) => {
        subscriber.error(new Error(`Imagen requiere extractor OCR/visión antes de tratarse como dogma: ${source.extension}`));
      });
    }

    return of({
      type: 'skipped',
      source,
      reason: `Tipo documental no soportado en v1: ${source.extension || '[sin extensión]'}`,
    });
  }
}

@Injectable()
export class LocalDocumentExtractorRegistry {
  constructor(
    @Inject(PlainTextDocumentExtractor) private readonly plainTextExtractor: PlainTextDocumentExtractor,
    @Inject(DocxDocumentExtractor) private readonly docxExtractor: DocxDocumentExtractor,
    @Inject(SpreadsheetDocumentExtractor) private readonly spreadsheetExtractor: SpreadsheetDocumentExtractor,
    @Inject(PdfDocumentExtractor) private readonly pdfExtractor: PdfDocumentExtractor,
    @Inject(UnsupportedDocumentExtractor) private readonly unsupportedExtractor: UnsupportedDocumentExtractor,
  ) {}

  extractorFor(source: FoundationDocSource): DocumentExtractorPort {
    return [
      this.plainTextExtractor,
      this.docxExtractor,
      this.spreadsheetExtractor,
      this.pdfExtractor,
      this.unsupportedExtractor,
    ].find((extractor) => extractor.canHandle(source)) ?? this.unsupportedExtractor;
  }
}
