import type {
  DocumentMimeType,
  DocumentStatus,
  DocumentType,
} from '../constants/document.constants';

export type {
  DocumentMimeType,
  DocumentStatus,
  DocumentType,
} from '../constants/document.constants';

export interface CreateDocumentRequest {
  file: File;
  chat_id: number;
  prefer_docling?: boolean;
}

export interface CreateDocumentResponse {
  id: number;
  name: string;
  mime_type: DocumentMimeType;
  status: DocumentStatus;
  storage_url: string;
  file_size_bytes: number;
  processing_started_at: string;
  created_by: number;
  created_at: string;
}

export interface Document {
  id: number;
  chat_id: number | null;
  name: string;
  description: string | null;
  mime_type: DocumentMimeType;
  status: DocumentStatus;
  storage_url: string;
  file_size_bytes: number;
  type: DocumentType | null;
  category: string | null;
  text_cleaner_type: string | null;
  text_splitter_type: string | null;
  embedder_type: string | null;
  split_size: number | null;
  split_overlap: number | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string | null;
  deleted_by: number | null;
  deleted_at: string | null;
}

export type DocumentResponse = Document;

export interface DocumentListResponse {
  documents: Document[];
}


