import type { Observable } from 'rxjs';
import type { DocumentExtractionEvent } from '#dogma-context/domain';
import type { FoundationDocSource } from '#ports';

export interface DocumentExtractorPort {
  canHandle(source: FoundationDocSource): boolean;
  extract(source: FoundationDocSource): Observable<DocumentExtractionEvent>;
}
