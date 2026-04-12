import type {
  ChatApiMessage,
  ChatDetail,
  ChatDetailApiRow,
  ChatListApiRow,
  ChatMembershipRow,
  DrfCursorPage,
  DrfNumberedPage,
  PaginatedChatsResponse,
  PaginatedMembershipsResponse,
  PaginatedMessagesResponse,
} from './types/chat.types';

const defaultChatType = 'individual' as const;

export function mapChatListRowToSummary(row: ChatListApiRow) {
  return {
    id: row.id,
    name: row.name,
    chat_type: defaultChatType,
    member_count: row.member_count,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: null,
  };
}

export function mapChatDetailApiToDetail(row: ChatDetailApiRow): ChatDetail {
  return {
    id: row.id,
    name: row.name,
    system_prompt: row.system_prompt,
    response_style: row.response_style,
    chat_type: defaultChatType,
    last_message_at: row.last_message_at,
    members: [],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeMessageRow(
  row: Omit<ChatApiMessage, 'deleted_at' | 'chat_id'> & { chat_id?: number; deleted_at?: string | null },
  chatId: number
): ChatApiMessage {
  return {
    id: row.id,
    chat_id: row.chat_id ?? chatId,
    message: row.message,
    sender_type: row.sender_type,
    created_by: row.created_by,
    created_at: row.created_at,
    deleted_at: row.deleted_at ?? null,
  };
}

export function mapDrfNumberedPageToChats(page: DrfNumberedPage<ChatListApiRow>): PaginatedChatsResponse {
  return {
    data: page.results.map(mapChatListRowToSummary),
    pagination: {
      total_count: page.count,
      has_more: page.next != null && page.next.length > 0,
      next_cursor: page.next,
    },
  };
}

export function mapDrfCursorPageToMessages(
  page: DrfCursorPage<ChatApiMessage | Omit<ChatApiMessage, 'deleted_at'>>,
  chatId: number
): PaginatedMessagesResponse {
  return {
    data: page.results.map((r) => normalizeMessageRow(r, chatId)),
    pagination: {
      total_count: page.results.length,
      has_more: page.next != null && page.next.length > 0,
      next_cursor: page.next,
    },
  };
}

export function sortMessagesChronological(messages: ChatApiMessage[]): ChatApiMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function mapDrfNumberedPageToMemberships(
  page: DrfNumberedPage<ChatMembershipRow>
): PaginatedMembershipsResponse {
  return {
    data: page.results,
    pagination: {
      total_count: page.count,
      has_more: page.next != null && page.next.length > 0,
      next_cursor: page.next,
    },
  };
}
