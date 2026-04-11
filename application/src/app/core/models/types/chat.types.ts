// --- HTTP API (v1) ---------------------------------------------------------------------------
// Dominio DB: una sola tabla `chat`; participantes en `chat_membership`. El chat grupal es el
// mismo concepto que el individual, con más `member_id` y `chat_type === 'group'` en API.

export interface ChatPagination {
  has_more: boolean;
  next_cursor: string | null;
  total_count: number;
}

export type ChatType = 'individual' | 'group';

export interface ChatSummary {
  id: number;
  name: string;
  chat_type: ChatType;
  member_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export type ChatMemberStatus = 'active' | 'inactive' | 'pending';

export interface ChatMember {
  id: number;
  member_id: number;
  status: ChatMemberStatus;
  joined_at: string | null;
}

export interface ChatDetail {
  id: number;
  name: string;
  system_prompt: string | null;
  response_style: string | null;
  chat_type: ChatType;
  last_message_at: string | null;
  members: ChatMember[];
  created_by: number;
  created_at: string;
  updated_at: string | null;
}

export interface CreateChatRequest {
  name: string;
  system_prompt?: string | null;
  response_style?: string | null;
  member_ids?: number[];
}

export interface PatchChatRequest {
  name?: string;
  system_prompt?: string | null;
  response_style?: string | null;
}

export interface PaginatedChatsResponse {
  data: ChatSummary[];
  pagination: ChatPagination;
}

export type MessageSenderType = 'user' | 'system';

export interface ChatApiMessage {
  id: number;
  chat_id: number;
  message: string;
  sender_type: MessageSenderType;
  created_by: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface PaginatedMessagesResponse {
  data: ChatApiMessage[];
  pagination: ChatPagination;
}

export interface CreateMessageRequest {
  message: string;
  sender_type: MessageSenderType;
}

export interface ChatStreamRequest {
  message: string;
}

export interface ChatStreamStartPayload {
  chat_id: number;
  status: string;
}

export interface ChatStreamDeltaPayload {
  delta: string;
}

export interface ChatStreamCompletePayload {
  message_id: number;
  chat_id: number;
  finish_reason: string;
}

export type ChatStreamErrorCode =
  | 'LLM_ERROR'
  | 'FORBIDDEN'
  | 'CONVERSATION_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ChatStreamErrorPayload {
  code: ChatStreamErrorCode;
  message: string;
}

export type ChatStreamEvent =
  | { event: 'start'; data: ChatStreamStartPayload }
  | { event: 'delta'; data: ChatStreamDeltaPayload }
  | { event: 'complete'; data: ChatStreamCompletePayload }
  | { event: 'error'; data: ChatStreamErrorPayload };

export type ChatApiErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'LLM_ERROR'
  | 'INTERNAL_ERROR';

export interface ChatApiErrorBody {
  error: ChatApiErrorCode;
  message: string;
}
