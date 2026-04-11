import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { CreateDocumentRequest, CreateDocumentResponse } from '@core/models/types/document.types';

@Injectable({ providedIn: 'root' })
export class DocumentProcessingHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.authenticationApiUrl;

  createDocument(body: CreateDocumentRequest): Observable<CreateDocumentResponse> {
    const preferDocling = body.prefer_docling ?? false;
    const data = new FormData();
    data.append('raw_document', body.file, body.file.name);
    data.append('chat_id', String(body.chat_id));
    data.append('prefer_docling', preferDocling ? 'true' : 'false');
    return this.http.post<CreateDocumentResponse>(`${this.base}/api/create-document`, data);
  }
}
