import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  DocumentProcessingCreateDocumentMultipartInput,
  DocumentProcessingCreateDocumentResponseDto,
} from '@aura-types/aura-document-processing-service.types';
import {
  DOCUMENT_PROCESSING_UPLOAD_FIELD_NAME,
  DOCUMENT_PROCESSING_MAX_ID,
  DOCUMENT_PROCESSING_MIN_FILE_SIZE_BYTES,
} from '@aura-types/aura-document-processing-service.types';

@Injectable({ providedIn: 'root' })
export class AuraDocumentProcessingServiceHttp {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.documentProcessingUrl.replace(/\/$/, '')}/api/v1`;

  createDocument(
    formData: FormData,
  ): Observable<DocumentProcessingCreateDocumentResponseDto> {
    return this.http.post<DocumentProcessingCreateDocumentResponseDto>(
      `${this.base}/create-document`,
      formData,
    );
  }

  createDocumentFromInput(
    input: DocumentProcessingCreateDocumentMultipartInput,
  ): Observable<DocumentProcessingCreateDocumentResponseDto> {
    if (typeof input.file.size === 'number' && input.file.size < DOCUMENT_PROCESSING_MIN_FILE_SIZE_BYTES) {
      throw new RangeError(
        `file size must be at least ${DOCUMENT_PROCESSING_MIN_FILE_SIZE_BYTES} byte(s); got ${input.file.size}.`,
      );
    }
    if (input.chat_id !== undefined && (!Number.isInteger(input.chat_id) || input.chat_id <= 0)) {
      throw new RangeError('chat_id must be a positive integer when provided.');
    }
    if (
      input.chat_id !== undefined &&
      (input.chat_id > DOCUMENT_PROCESSING_MAX_ID ||
        !Number.isFinite(input.chat_id))
    ) {
      throw new RangeError(`chat_id must be <= ${DOCUMENT_PROCESSING_MAX_ID}.`);
    }

    const data = new FormData();
    const name =
      input.filename ?? (input.file instanceof File ? input.file.name : 'document');
    data.append(DOCUMENT_PROCESSING_UPLOAD_FIELD_NAME, input.file, name);
    if (input.chat_id !== undefined) {
      data.append('chat_id', String(input.chat_id));
    }
    data.append('prefer_docling', input.prefer_docling === true ? 'true' : 'false');

    return this.createDocument(data);
  }
}
