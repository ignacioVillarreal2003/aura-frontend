export const DocumentMimeType = {
  pdf: 'pdf',
  docx: 'docx',
} as const;

export type DocumentMimeType = (typeof DocumentMimeType)[keyof typeof DocumentMimeType];

export const DocumentStatus = {
  uploaded: 'uploaded',
  processing: 'processing',
  processed: 'processed',
  failed: 'failed',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DocumentType = {
  manual: 'manual',
  informe: 'informe',
  orden: 'orden',
  doctrina: 'doctrina',
  otro: 'otro',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
