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
  tags: string[];
  is_ephemeral: boolean;
  is_locked: boolean;
  last_message_at: string | null;
  is_archived: boolean;
  created_by: number;
  created_at: string;
  member_count: number;
  unread_count: number;
  is_pinned: boolean;
  archived_at: string | null;
  is_muted: boolean;
}

export interface ChatDetailApiRow {
  id: number;
  name: string;
  system_prompt: string | null;
  response_style: string | null;
  tags: string[];
  is_ephemeral: boolean;
  is_locked: boolean;
  last_message_at: string | null;
  is_archived: boolean;
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
  is_archived: boolean;
  is_pinned: boolean;
  unread_count: number;
  tags: string[];
}

export type ChatMemberStatus = 'active' | 'inactive' | 'pending';
export type ChatMemberRole = 'owner' | 'editor' | 'reader';

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
  is_bookmarked: boolean;
  user_feedback: 1 | -1 | null;
  thread_reply_count: number;
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
  transcript: string | null;
  assistant: AssistantBlock | null;
  assistant_error: AssistantErrorBlock | null;
}

export interface RegenerateResponse {
  assistant: AssistantBlock | null;
  assistant_error: AssistantErrorBlock | null;
}

export interface ChatMembershipRow {
  id: number;
  member_id: number;
  chat_id: number;
  status: ChatMemberStatus;
  role: ChatMemberRole;
  joined_at: string | null;
  left_at: string | null;
  created_by: number;
  created_at: string;
}

export interface AddMembersRequest {
  member_ids: number[];
}

export interface UpdateMemberRequest {
  status: ChatMemberStatus;
}

export interface UpdateMemberRoleRequest {
  role: ChatMemberRole;
}

export interface PaginatedMembershipsResponse {
  data: ChatMembershipRow[];
  pagination: ChatPagination;
}

export interface PinnedMessageApiRow {
  id: number;
  chat_id: number;
  message_id: number;
  pinned_by: number;
  pinned_at: string;
  message: Omit<ChatApiMessage, 'deleted_at' | 'chat_id'> & { chat_id?: number; deleted_at?: string | null };
}

export interface PinnedMessageRow {
  id: number;
  chat_id: number;
  message_id: number;
  pinned_by: number;
  pinned_at: string;
  message: ChatApiMessage;
}

export interface PaginatedPinnedMessagesResponse {
  data: PinnedMessageRow[];
  pagination: ChatPagination;
}

export interface ThreadReplyRow {
  id: number;
  parent_message_id: number;
  message: string;
  created_by: number;
  created_at: string;
}

export interface MessageFeedbackRow {
  id: number;
  message_id: number;
  user_id: number;
  value: 1 | -1;
  created_at: string;
  updated_at: string | null;
}

export interface ShareLinkRow {
  id: number;
  chat_id: number;
  token: string;
  created_by: number;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface CreateShareLinkRequest {
  expires_at?: string | null;
}

export interface PaginatedShareLinksResponse {
  data: ShareLinkRow[];
  pagination: ChatPagination;
}

export type WebhookEvent =
  | 'message.created'
  | 'member.joined'
  | 'member.left'
  | 'chat.locked'
  | 'chat.unlocked';

export interface WebhookRow {
  id: number;
  chat_id: number;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  created_by: number;
  created_at: string;
}

export interface WebhookCreateRow extends WebhookRow {
  secret: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
}

export interface PatchWebhookRequest {
  url?: string;
  events?: WebhookEvent[];
  is_active?: boolean;
}

export interface PaginatedWebhooksResponse {
  data: WebhookRow[];
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
