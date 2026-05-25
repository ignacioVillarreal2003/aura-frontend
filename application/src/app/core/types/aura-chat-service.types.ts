export const AURA_CHAT_TAGS_MAX_ITEMS = 20 as const;

export const AURA_CHAT_TAG_MAX_CHAR = 50 as const;

export const AURA_CHAT_NAME_MAX_CHAR = 255 as const;

export const AURA_CHAT_BULK_IDS_MIN = 1 as const;

export const AURA_CHAT_BULK_IDS_MAX = 100 as const;

export const AURA_CHAT_SEND_MESSAGE_MAX_CHAR = 10_000 as const;

export const AURA_CHAT_THREAD_REPLY_MAX_CHAR = 5_000 as const;

export const AURA_CHAT_INVITE_IDS_MIN = 1 as const;

export const AURA_CHAT_INVITE_IDS_MAX = 50 as const;

export const AURA_CHAT_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

export const AURA_CHAT_SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'audio/x-wav',
  'audio/x-m4a',
] as const;

export type AuraChatSupportedAudioMimeType =
  (typeof AURA_CHAT_SUPPORTED_AUDIO_MIME_TYPES)[number];

export const AURA_CHAT_PAGE_SIZE_DEFAULT = 20 as const;

export const AURA_CHAT_CURSOR_PAGE_SIZE_DEFAULT = 50 as const;

export const AURA_CHAT_PAGE_SIZE_MAX = 100 as const;

export const AURA_CHAT_ORDERING_FIELDS = [
  'last_message_at',
  '-last_message_at',
  'created_at',
  '-created_at',
  'name',
  '-name',
] as const;

export type AuraChatOrdering = (typeof AURA_CHAT_ORDERING_FIELDS)[number];

export const AURA_CHAT_WS_MESSAGE_MAX_CHAR = 10_000 as const;

export const AURA_CHAT_EXPORT_MAX_MESSAGES_DEFAULT = 2_000 as const;

export const AURA_CHAT_EXPORT_CONTENT_TYPE = {
  pdf: 'application/pdf',
  markdown: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
} as const;

export type IsoDateTimeString = string;

export type MessageSenderType = 'system' | 'user';

export type MembershipStatus = 'active' | 'inactive' | 'pending';

export type MembershipListStatusFilter =
  | MembershipStatus
  | 'all';

export type MembershipRole = 'owner' | 'editor' | 'reader';

export type FeedbackValue = 1 | -1;

export const AURA_CHAT_WEBHOOK_EVENTS = [
  'message.created',
  'member.joined',
  'member.left',
  'chat.locked',
  'chat.unlocked',
] as const;

export type WebhookEvent = (typeof AURA_CHAT_WEBHOOK_EVENTS)[number];

export type HealthStatus = 'ok' | 'degraded';

export type HealthCheckEntry = Record<string, 'ok' | 'error'>;

export interface ChatDetailDto {
  readonly id: number;
  readonly name: string;
  readonly system_prompt: string | null;
  readonly response_style: string | null;
  readonly tags: readonly string[];
  readonly is_ephemeral: boolean;
  readonly is_locked: boolean;
  readonly last_message_at: IsoDateTimeString | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface ChatListItemDto {
  readonly id: number;
  readonly name: string;
  readonly tags: readonly string[];
  readonly is_ephemeral: boolean;
  readonly is_locked: boolean;
  readonly last_message_at: IsoDateTimeString | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly member_count: number;
  readonly unread_count: number;
  readonly is_pinned: boolean;
  readonly archived_at: IsoDateTimeString | null;
  readonly is_muted: boolean;
}

export interface MessageDto {
  readonly id: number;
  readonly chat_id: number;
  readonly message: string;
  readonly sender_type: MessageSenderType;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly is_bookmarked: boolean;
  readonly user_feedback: FeedbackValue | null;
  readonly thread_reply_count: number;
  readonly fragments?: readonly ChatFragment[] | null;
}

export interface ThreadReplyDto {
  readonly id: number;
  readonly parent_message_id: number;
  readonly message: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface MessageFeedbackDto {
  readonly id: number;
  readonly message_id: number;
  readonly user_id: number;
  readonly value: FeedbackValue;
  readonly created_at: IsoDateTimeString;
  readonly updated_at: IsoDateTimeString | null;
}

export interface PinnedMessageDto {
  readonly id: number;
  readonly chat_id: number;
  readonly message_id: number;
  readonly pinned_by: number;
  readonly pinned_at: IsoDateTimeString;
  readonly message: MessageDto;
}

export interface ChatFragmentDocument {
  readonly id: number;
  readonly name: string;
  readonly description?: string | null;
  readonly type?: string | null;
  readonly category?: string | null;
}

export interface ChatFragment {
  readonly id: number;
  readonly content: string;
  readonly fragment_index: number;
  readonly summary?: string | null;
  readonly topics?: readonly string[] | null;
  readonly document: ChatFragmentDocument;
  readonly document_id?: number;
}

export interface AssistantBlockDto {
  readonly question: string;
  readonly answer: string;
  readonly fragments: readonly ChatFragment[];
}

export interface AssistantErrorDto {
  readonly detail: string;
}

export interface SendMessageResponseDto {
  readonly message: MessageDto;
  readonly transcript: string | null;
  readonly assistant: AssistantBlockDto | null;
  readonly assistant_error: AssistantErrorDto | null;
}

export interface RegenerateResponseDto {
  readonly assistant: AssistantBlockDto | null;
  readonly assistant_error: AssistantErrorDto | null;
}

export interface MembershipDto {
  readonly id: number;
  readonly member_id: number;
  readonly chat_id: number;
  readonly status: MembershipStatus;
  readonly role: MembershipRole;
  readonly joined_at: IsoDateTimeString | null;
  readonly left_at: IsoDateTimeString | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface ShareLinkDto {
  readonly id: number;
  readonly chat_id: number;
  readonly token: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly expires_at: IsoDateTimeString | null;
  readonly is_active: boolean;
}

export interface WebhookDto {
  readonly id: number;
  readonly chat_id: number;
  readonly url: string;
  readonly events: readonly WebhookEvent[];
  readonly is_active: boolean;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface WebhookCreatedDto extends WebhookDto {
  readonly secret: string;
}

export interface HealthResponseDto {
  readonly status: HealthStatus;
  readonly checks: HealthCheckEntry;
}

export interface BulkArchiveChatResultDto {
  readonly archived: number;
}

export interface BulkUnarchiveChatResultDto {
  readonly unarchived: number;
}

export interface CreateChatBody {
  readonly name: string;
  readonly system_prompt?: string | null;
  readonly response_style?: string | null;
  readonly tags?: readonly string[];
  readonly is_ephemeral?: boolean;
}

export interface UpdateChatBody {
  readonly name?: string;
  readonly system_prompt?: string | null;
  readonly response_style?: string | null;
  readonly tags?: readonly string[];
  readonly is_ephemeral?: boolean;
}

export interface MuteChatBody {
  readonly muted_until: IsoDateTimeString;
}

export interface BulkChatIdsBody {
  readonly ids: readonly number[];
}

export interface ShareLinkCreateBody {
  readonly expires_at?: IsoDateTimeString | null;
}

export interface WebhookCreateBody {
  readonly url: string;
  readonly events: readonly WebhookEvent[];
}

export interface WebhookPatchBody {
  readonly url?: string;
  readonly events?: readonly WebhookEvent[];
  readonly is_active?: boolean;
}

export interface SendThreadReplyBody {
  readonly message: string;
}

export interface SetFeedbackBody {
  readonly value: FeedbackValue;
}

export interface SendMessageTextJsonBody {
  readonly message: string;
}

export interface AddMembersBody {
  readonly member_ids: readonly number[];
}

export interface UpdateMemberStatusBody {
  readonly status: MembershipStatus;
}

export interface UpdateMemberRoleBody {
  readonly role: MembershipRole;
}

export interface ChatListQueryParams {
  readonly search?: string;
  readonly ordering?: AuraChatOrdering;
  readonly tags?: string;
  readonly page?: number;
  readonly page_size?: number;
}

export interface MemberListQueryParams {
  readonly status?: MembershipListStatusFilter;
  readonly page?: number;
  readonly page_size?: number;
}

export interface CursorPaginationQueryParams {
  readonly cursor?: string;
  readonly page_size?: number;
}

export interface PageNumberResult<T> {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly T[];
}

export interface CursorPageResult<T> {
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly T[];
}

export interface AuraChatApiError {
  readonly error: string;
  readonly detail: string;
  readonly status_code: number;
}

export interface AuraChatApiValidationError extends AuraChatApiError {
  readonly fields?: unknown;
}

export interface AuraChatMemberListBadRequestError extends AuraChatApiError {
  readonly error: 'bad_request';
  readonly detail: string;
  readonly status_code: 400;
}

export interface ChatExportBackupChatDto {
  readonly id: number;
  readonly name: string;
  readonly tags: readonly string[];
  readonly system_prompt: string | null;
  readonly response_style: string | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString | null;
}

export interface ChatExportBackupMessageDto {
  readonly id: number;
  readonly sender_type: string;
  readonly message: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString | null;
}

export interface ChatExportBackupDto {
  readonly chat: ChatExportBackupChatDto;
  readonly exported_at: IsoDateTimeString;
  readonly message_count: number;
  readonly messages: readonly ChatExportBackupMessageDto[];
}

export type AuraChatWsClientMessage =
  | { readonly type: 'chat.message'; readonly message: string }
  | { readonly type: 'chat.typing'; readonly is_typing: boolean };

export type AuraChatWsServerMessage =
  | { readonly type: 'chat_ai_lock'; readonly locked: boolean }
  | {
      readonly type: 'error';
      readonly detail: string;
      readonly error_code?: string;
    }
  | {
      readonly type: 'user_message';
      readonly id: number;
      readonly message: string;
      readonly sender_type: MessageSenderType;
      readonly created_by: number;
      readonly created_at: IsoDateTimeString;
    }
  | { readonly type: 'ai_meta'; readonly chat_id: number }
  | {
      readonly type: 'ai_context';
      readonly question: string;
      readonly fragments: readonly ChatFragment[];
    }
  | { readonly type: 'ai_progress'; readonly step: string; readonly message: string }
  | { readonly type: 'ai_delta'; readonly delta: string }
  | {
      readonly type: 'ai_complete';
      readonly message: string;
      readonly answer: string;
      readonly question: string;
      readonly fragments: readonly ChatFragment[];
      readonly id?: number;
      readonly sender_type?: MessageSenderType;
      readonly created_by?: number;
      readonly created_at?: IsoDateTimeString;
    }
  | {
      readonly type: 'ai_error';
      readonly detail: string;
      readonly code?: string;
    }
  | {
      readonly type: 'typing';
      readonly user_id: number;
      readonly is_typing: boolean;
    }
  | {
      readonly type: 'chat_locked_changed';
      readonly is_locked: boolean;
      readonly by?: number;
    }
  | { readonly type: 'member_joined'; readonly member_id: number }
  | { readonly type: 'member_left'; readonly member_id: number };
