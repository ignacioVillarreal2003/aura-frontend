// --- HTTP API (v1) — aura-chat-service (DRF) + WebSocket --------------------------------------

export type ChatType = 'individual' | 'group';

export interface DrfNumberedPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DrfCursorPage<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ChatListApiRow {
  id: number;
  name: string;
  last_message_at: string | null;
  created_by: number;
  created_at: string;
  member_count: number;
}

export interface ChatDetailApiRow {
  id: number;
  name: string;
  system_prompt: string | null;
  response_style: string | null;
  last_message_at: string | null;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string | null;
}

export interface ChatPagination {
  has_more: boolean;
  next_cursor: string | null;
  total_count: number;
}

export interface ChatSummary {
  id: number;
  name: string;
  chat_type: ChatType;
  member_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export type ChatMembershipStatus = 'active' | 'inactive' | 'pending';

export interface ChatMember {
  id: number;
  member_id: number;
  status: ChatMembershipStatus;
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

export interface AssistantBlock {
  question: string;
  answer: string;
  fragments: Record<string, unknown>[];
}

export interface AssistantErrorBlock {
  detail: string;
}

export interface SendMessageResponse {
  message: ChatApiMessage;
  assistant: AssistantBlock | null;
  assistant_error: AssistantErrorBlock | null;
}

export interface ChatMembership {
  id: number;
  member_id: number;
  chat_id: number;
  status: ChatMembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  created_by: number;
  created_at: string;
}

export type ChatMembershipRow = ChatMembership;

export interface Chat {
  id: number;
  name: string;
}

export interface User {
  name: string;
  email?: string;
  role?: string;
  member_id?: number | null;
}

export interface AddMembersRequest {
  member_ids: number[];
}

export interface UpdateMemberRequest {
  status: ChatMembershipStatus;
}

export interface PaginatedMembershipsResponse {
  data: ChatMembership[];
  pagination: ChatPagination;
}

export type ChatWsIncoming =
  | {
      type: 'user_message';
      id: number;
      message: string;
      sender_type: MessageSenderType;
      created_by: number | null;
      created_at: string;
    }
  | { type: 'ai_meta'; chat_id: number }
  | { type: 'ai_context'; question: string; fragments: unknown[] }
  | { type: 'ai_delta'; delta: string }
  | {
      type: 'ai_complete';
      message: string;
      answer: string;
      question: string;
      fragments: unknown[];
      id?: number;
      sender_type?: MessageSenderType;
      created_by?: number | null;
      created_at?: string;
    }
  | { type: 'ai_error'; detail: string; code?: string }
  | { type: 'typing'; user_id: number; is_typing: boolean }
  | { type: 'error'; detail: string }
  | { type: 'member_joined'; member_id: number }
  | { type: 'member_left'; member_id: number };

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
