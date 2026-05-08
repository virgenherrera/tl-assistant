import type { Observable } from 'rxjs';
import type { DocumentExtractionEvent } from '#foundation-context/domain';
import type { FoundationSource } from '#ports';

export interface DocumentExtractorPort {
  canHandle(source: FoundationSource): boolean;
  extract(source: FoundationSource): Observable<DocumentExtractionEvent>;
}
