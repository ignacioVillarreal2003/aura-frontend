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

export type FeedbackReason =
  | 'incorrect'
  | 'incomplete'
  | 'off_topic'
  | 'tone'
  | 'too_long'
  | 'hallucination'
  | 'other';

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
  readonly is_pinned: boolean;
  readonly archived_at: IsoDateTimeString | null;
  readonly is_muted: boolean;
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
  readonly user_feedback_reason: FeedbackReason | null;
  readonly user_feedback_comment: string | null;
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
  readonly reason: FeedbackReason | null;
  readonly comment: string | null;
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
  readonly chat_name: string;
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

export interface SendThreadReplyBody {
  readonly message: string;
}

export interface SetFeedbackBody {
  readonly value: FeedbackValue;
  readonly reason?: FeedbackReason | null;
  readonly comment?: string | null;
}

export interface FeedbackAnalyticsQuery {
  readonly days?: number;
}

export interface FeedbackSummaryDto {
  readonly total: number;
  readonly thumbs_up: number;
  readonly thumbs_down: number;
  readonly satisfaction_rate: number | null;
}

export interface FeedbackAssistantRowDto {
  readonly assistant_id: number | null;
  readonly assistant_name: string;
  readonly total: number;
  readonly thumbs_up: number;
  readonly thumbs_down: number;
  readonly satisfaction_rate: number | null;
}

export interface FeedbackReasonRowDto {
  readonly reason: FeedbackReason | null;
  readonly count: number;
}

export interface FeedbackNegativeRowDto {
  readonly id: number;
  readonly message_id: number;
  readonly assistant_id: number | null;
  readonly assistant_name: string;
  readonly reason: FeedbackReason | null;
  readonly comment: string | null;
  readonly user_id: number;
  readonly created_at: IsoDateTimeString;
  readonly message_excerpt: string;
}

export interface FeedbackAnalyticsDto {
  readonly window_days: number;
  readonly start: IsoDateTimeString;
  readonly end: IsoDateTimeString;
  readonly summary: FeedbackSummaryDto;
  readonly assistants: readonly FeedbackAssistantRowDto[];
  readonly reasons: readonly FeedbackReasonRowDto[];
  readonly recent_negative: readonly FeedbackNegativeRowDto[];
}

export interface SendMessageTextJsonBody {
  readonly message: string;
  readonly mode?: AuraChatAiMode;
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

// ── Reports ────────────────────────────────────────────────────────────────────

export type ReportType = 'SITREP' | 'INTSUM' | 'OPORD';
export type ReportMode = 'direct' | 'rag';

export interface ReportDto {
  readonly id: number;
  readonly type: ReportType;
  readonly title: string;
  readonly content: string;
  readonly mode: ReportMode;
  readonly metadata: Record<string, unknown>;
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface ReportListItemDto {
  readonly id: number;
  readonly type: ReportType;
  readonly title: string;
  readonly mode: ReportMode;
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateMessageDto {
  readonly role: 'human' | 'assistant';
  readonly content: string;
}

export interface GenerateFragmentDto {
  readonly document?: Record<string, unknown>;
  readonly content?: string;
}

export interface GenerateReportBody {
  readonly type: ReportType;
  readonly mode: ReportMode;
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface ReportGenerateResponseDto {
  readonly report: ReportDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

export interface UpdateReportBody {
  readonly title?: string;
  readonly content?: string;
}

// ── Checklists ─────────────────────────────────────────────────────────────────

export type ChecklistMode = 'direct' | 'rag';

export interface ChecklistItemDto {
  readonly id: string;
  readonly text: string;
  readonly is_checked: boolean;
  readonly notes: string;
  readonly position: number;
}

export interface ChecklistSectionDto {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly items: readonly ChecklistItemDto[];
}

export interface ChecklistDto {
  readonly id: number;
  readonly title: string;
  readonly sections: readonly ChecklistSectionDto[];
  readonly mode: ChecklistMode;
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface ChecklistListItemDto {
  readonly id: number;
  readonly title: string;
  readonly mode: ChecklistMode;
  readonly source_chat_id: number | null;
  readonly item_count: number;
  readonly checked_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateChecklistBody {
  readonly mode: ChecklistMode;
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface ChecklistGenerateResponseDto {
  readonly checklist: ChecklistDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

export interface UpdateChecklistItemBody {
  readonly text: string;
  readonly is_checked: boolean;
  readonly notes: string;
  readonly position: number;
}

export interface UpdateChecklistSectionBody {
  readonly title: string;
  readonly position: number;
  readonly items: readonly UpdateChecklistItemBody[];
}

export interface UpdateChecklistBody {
  readonly title?: string;
  readonly sections?: readonly UpdateChecklistSectionBody[];
}

// ── Assistants ─────────────────────────────────────────────────────────────────

export interface AssistantDto {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly avatar_emoji: string;
  readonly is_active: boolean;
  readonly created_at: IsoDateTimeString;
}

export interface AssistantAdminDto extends AssistantDto {
  readonly system_prompt: string;
  readonly created_by: number;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface CreateAssistantBody {
  readonly name: string;
  readonly description?: string;
  readonly system_prompt: string;
  readonly avatar_emoji?: string;
  readonly is_active?: boolean;
}

export interface UpdateAssistantBody {
  readonly name?: string;
  readonly description?: string;
  readonly system_prompt?: string;
  readonly avatar_emoji?: string;
  readonly is_active?: boolean;
}

export interface StartChatResponseDto {
  readonly chat_id: number;
  readonly chat_name: string;
  readonly is_new: boolean;
}

export type AuraChatAiMode = 'document_question' | 'general_chat' | 'rag_agent' | 'agent';

export const AURA_CHAT_AI_MODE_DEFAULT: AuraChatAiMode = 'document_question';

export type AuraChatWsClientMessage =
  | { readonly type: 'chat.message'; readonly message: string; readonly mode?: AuraChatAiMode }
  | { readonly type: 'chat.regenerate'; readonly mode?: AuraChatAiMode }
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
