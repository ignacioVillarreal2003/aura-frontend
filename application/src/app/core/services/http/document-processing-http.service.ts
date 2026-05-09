import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentListResponse,
  DocumentResponse,
} from '@core/models/types/document.types';

@Injectable({ providedIn: 'root' })
export class DocumentProcessingHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.documentProcessingUrl.replace(/\/$/, '');

  createDocument(body: CreateDocumentRequest): Observable<CreateDocumentResponse> {
    const preferDocling = body.prefer_docling ?? false;
    const data = new FormData();
    data.append('raw_document', body.file, body.file.name);
    data.append('chat_id', String(body.chat_id));
    data.append('prefer_docling', preferDocling ? 'true' : 'false');
    return this.http.post<CreateDocumentResponse>(`${this.base}/api/create-document`, data);
  }

  /**
   * Listado por chat (ajustá la ruta si tu backend usa otro contrato).
   */
  listDocumentsByChat(chatId: number): Observable<DocumentResponse[]> {
    const params = new HttpParams().set('chat_id', String(chatId));
    return this.http.get<DocumentListResponse>(`${this.base}/api/documents`, { params }).pipe(
      map((r) => r.documents ?? []),
      map((docs) => docs.filter((d) => d.chat_id === chatId))
    );
  }
}
