export const DOCUMENT_PROCESSING_MAX_ID = 2_147_483_647 as const;

export const DOCUMENT_PROCESSING_MAX_NAME_CHARS = 255 as const;

export const DOCUMENT_PROCESSING_MIN_FILE_SIZE_BYTES = 1 as const;

export const DOCUMENT_PROCESSING_MAX_MIME_TYPE_CHARS = 64 as const;

export const DOCUMENT_PROCESSING_MAX_STATUS_CHARS = 64 as const;

export const DOCUMENT_PROCESSING_UPLOAD_FIELD_NAME = 'file' as const;

export interface DocumentQueryChatDocumentDto {
  readonly id: number;
  readonly chat_id: number | null;
  readonly name: string;
  readonly description: string | null;
  readonly mime_type: string;
  readonly status: string;
  readonly file_size_bytes: number;
  readonly type: string | null;
  readonly category: string | null;
  readonly created_by: number;
  readonly created_at: string;
  readonly updated_at: string | null;
}

export interface DocumentQueryListByChatResponseDto {
  readonly documents: readonly DocumentQueryChatDocumentDto[];
}

export interface DocumentProcessingCreateDocumentResponseDto {
  readonly id: number;
  readonly name: string;
  readonly mime_type: string;
  readonly status: string;
  readonly file_size_bytes: number;
}

export interface DocumentProcessingCreateDocumentMultipartInput {
  readonly file: Blob;
  readonly filename?: string;
  readonly chat_id?: number;
  readonly prefer_docling?: boolean;
}

export const DOCUMENT_SEARCH_MAX_QUERY_CHARS = 1_000 as const;

export const DOCUMENT_SEARCH_MAX_RESULTS = 50 as const;

export const DOCUMENT_SEARCH_DEFAULT_RESULTS = 10 as const;

export interface DocumentSearchRequestDto {
  readonly query: string;
  readonly max_documents?: number;
}

export interface DocumentSearchResultDto {
  readonly document: DocumentQueryChatDocumentDto;
  readonly similarity: number;
  readonly matched_fragments: number;
  readonly best_fragment_snippet: string | null;
}

export interface DocumentSearchResponseDto {
  readonly results: readonly DocumentSearchResultDto[];
}

export interface DocumentProcessingValidationErrorItem {
  readonly loc: readonly (string | number)[];
  readonly msg: string;
  readonly type: string;
}

export interface DocumentProcessingValidationErrorDto {
  readonly error: 'ValidationError';
  readonly message: string;
  readonly detail: readonly DocumentProcessingValidationErrorItem[];
  readonly request_id?: string | null;
}

export interface DocumentProcessingHttpErrorDto {
  readonly error: string;
  readonly message: string | Readonly<Record<string, unknown>>;
  readonly request_id?: string | null;
}

export interface DocumentProcessingAppErrorDto {
  readonly error: string;
  readonly message: string;
  readonly request_id?: string | null;
}
