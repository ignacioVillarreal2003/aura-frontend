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

export type MessageSenderType = 'user' | 'assistant';

export type ArtifactType =
  | 'MESSAGE'
  | 'REPORT'
  | 'CHECKLIST'
  | 'QUIZ'
  | 'TIMELINE'
  | 'LESSONS_LEARNED'
  | 'DECISION_BRIEF'
  | 'DOCUMENT_SUMMARY'
  | 'DOCUMENT_ACTION';

export type ArtifactStatus = 'draft' | 'final' | 'archived';
export type ArtifactMode = 'direct' | 'rag';

export interface ArtifactMessagePreviewDto {
  readonly id: number;
  readonly message: string;
  readonly sender_type: 'user' | 'assistant';
  readonly created_at: IsoDateTimeString;
}

export interface ArtifactSummaryDto {
  readonly id: number;
  readonly type: ArtifactType;
  readonly title: string;
  readonly description: string;
  readonly status: ArtifactStatus;
  readonly version: number;
  readonly mode: ArtifactMode;
  readonly fragments: readonly unknown[] | null;
  readonly is_bookmarked: boolean;
  readonly user_feedback: FeedbackValue | null;
  readonly thread_reply_count: number;
  readonly source_chat_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_at: IsoDateTimeString | null;
  readonly message: ArtifactMessagePreviewDto | null;
  readonly linked_id: number | null;
}

export interface ArtifactDetailDto {
  readonly id: number;
  readonly type: ArtifactType;
  readonly title: string;
  readonly description: string;
  readonly status: ArtifactStatus;
  readonly version: number;
  readonly mode: ArtifactMode;
  readonly fragments: readonly unknown[] | null;
  readonly source_chat_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface ArtifactVersionDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly version_number: number;
  readonly title: string;
  readonly description: string;
  readonly status: ArtifactStatus;
  readonly mode: ArtifactMode;
  readonly change_summary: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface PinnedArtifactDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly artifact: ArtifactSummaryDto;
}

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
  readonly is_locked: boolean;
  readonly is_pinned: boolean;
  readonly archived_at: IsoDateTimeString | null;
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
  readonly is_locked: boolean;
  readonly last_message_at: IsoDateTimeString | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly member_count: number;
  readonly unread_count: number;
  readonly is_pinned: boolean;
  readonly archived_at: IsoDateTimeString | null;
}

export interface MessageDto {
  readonly id: number;
  readonly artifact_id: number;
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
  readonly parent_artifact_id: number;
  readonly message: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_by: number | null;
  readonly updated_at: IsoDateTimeString | null;
}

export interface UpdateThreadReplyBody {
  readonly message: string;
}

export interface MessageFeedbackDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly created_by: number;
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

/** A human-to-human message in a chat's peer channel (no AI involved). */
export interface PeerMessageDto {
  readonly id: number;
  readonly chat_id: number;
  readonly message: string;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
  readonly updated_at: IsoDateTimeString | null;
  readonly is_edited: boolean;
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
}

export interface UpdateChatBody {
  readonly name?: string;
  readonly system_prompt?: string | null;
  readonly response_style?: string | null;
  readonly tags?: readonly string[];
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
  readonly chat_id: number;
  readonly message: string;
  readonly mode?: AuraChatAiMode;
  readonly retrieve_context?: boolean | null;
  readonly process_documents?: boolean | null;
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

/**
 * Generation context flags shared by every "generate" request body.
 * They replaced the old `mode: 'direct' | 'rag'`:
 *  - retrieve_context: recuperar contexto de la base de conocimiento (RAG).
 *  - process_documents: procesar el contenido completo de los documentos adjuntos.
 * `null`/omitido = usar el default del servicio.
 */
export interface GenerationContextFields {
  readonly retrieve_context?: boolean | null;
  readonly process_documents?: boolean | null;
  readonly document_ids?: readonly number[];
}

export interface ReportDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly type: ReportType;
  readonly title: string;
  readonly description: string;
  readonly query: string;
  readonly content: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface ReportListItemDto {
  readonly id: number;
  readonly type: ReportType;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
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

export interface GenerateReportBody extends GenerationContextFields {
  readonly type: ReportType;
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface ReportGenerateResponseDto {
  readonly report: ReportDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── Checklists ─────────────────────────────────────────────────────────────────

export interface ChecklistItemDto {
  readonly id: string;
  readonly text: string;
  readonly is_checked: boolean;
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
  readonly artifact_id: number;
  readonly title: string;
  readonly description: string;
  readonly query: string;
  readonly sections: readonly ChecklistSectionDto[];
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface ChecklistListItemDto {
  readonly id: number;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly source_chat_id: number | null;
  readonly item_count: number;
  readonly checked_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateChecklistBody extends GenerationContextFields {
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface ChecklistGenerateResponseDto {
  readonly checklist: ChecklistDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── Quiz ───────────────────────────────────────────────────────────────────────

export type QuizQuestionKind = 'single' | 'multiple' | 'boolean';

export interface QuizOptionDto {
  readonly id: number;
  readonly text: string;
  readonly position: number;
}

export interface QuizQuestionDto {
  readonly id: number;
  readonly text: string;
  readonly kind: QuizQuestionKind;
  readonly explanation: string;
  readonly position: number;
  readonly options: readonly QuizOptionDto[];
  readonly selected_option_id: number | null;
  readonly correct_option_ids: readonly number[];
}

export interface QuizDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly description: string;
  readonly query: string;
  readonly instructions: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly questions: readonly QuizQuestionDto[];
  readonly total_questions: number;
  readonly answered_count: number;
  readonly correct_count: number;
  readonly score_pct: number;
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface QuizAnswerResultDto {
  readonly question_id: number;
  readonly selected_option_id: number;
  readonly is_correct: boolean;
  readonly correct_option_ids: readonly number[];
  readonly answered_count: number;
  readonly correct_count: number;
  readonly total_questions: number;
  readonly score_pct: number;
}

export interface QuizListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly source_chat_id: number | null;
  readonly question_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateQuizBody extends GenerationContextFields {
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface QuizGenerateResponseDto {
  readonly quiz: QuizDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── Timeline ───────────────────────────────────────────────────────────────────

export interface TimelineEventDto {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly occurred_label: string;
  readonly position: number;
}

export interface TimelineDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly query: string;
  readonly description: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly events: readonly TimelineEventDto[];
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface TimelineListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly source_chat_id: number | null;
  readonly event_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateTimelineBody extends GenerationContextFields {
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface TimelineGenerateResponseDto {
  readonly timeline: TimelineDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── LessonsLearned ─────────────────────────────────────────────────────────────

export type LessonsLearnedCategory = 'sustain' | 'improve' | 'recommendation';

export interface LessonsLearnedItemDto {
  readonly id: number;
  readonly category: LessonsLearnedCategory;
  readonly observation: string;
  readonly discussion: string;
  readonly recommendation: string;
  readonly position: number;
}

export interface LessonsLearnedDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly query: string;
  readonly description: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly items: readonly LessonsLearnedItemDto[];
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface LessonsLearnedListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly source_chat_id: number | null;
  readonly item_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateLessonsLearnedBody extends GenerationContextFields {
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface LessonsLearnedGenerateResponseDto {
  readonly lessons_learned: LessonsLearnedDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── DecisionBrief ──────────────────────────────────────────────────────────────

export interface DecisionBriefOptionDto {
  readonly id: number;
  readonly title: string;
  readonly pros: string;
  readonly cons: string;
  readonly is_recommended: boolean;
  readonly position: number;
}

export interface DecisionBriefDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly query: string;
  readonly description: string;
  readonly context: string;
  readonly risks: string;
  readonly recommendation: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly document_ids: readonly number[];
  readonly options: readonly DecisionBriefOptionDto[];
  readonly source_chat_id: number | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface DecisionBriefListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly retrieve_context: boolean | null;
  readonly process_documents: boolean | null;
  readonly source_chat_id: number | null;
  readonly option_count: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateDecisionBriefBody extends GenerationContextFields {
  readonly message: string;
  readonly chat_id?: number | null;
}

export interface DecisionBriefGenerateResponseDto {
  readonly decision_brief: DecisionBriefDto;
  readonly messages: readonly GenerateMessageDto[];
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── DocumentSummary ────────────────────────────────────────────────────────────

export interface DocumentSummaryDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly description: string;
  readonly summary: string;
  readonly source_chat_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface DocumentSummaryListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly source_chat_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateDocumentSummaryBody extends GenerationContextFields {
  readonly document_ids: readonly number[];
  readonly chat_id: number;
}

export interface DocumentSummaryGenerateResponseDto {
  readonly document_summary: DocumentSummaryDto;
  readonly fragments: readonly GenerateFragmentDto[];
}

// ── DocumentAction ─────────────────────────────────────────────────────────────

export type DocumentActionType =
  | 'summarize'
  | 'essay'
  | 'key_points'
  | 'compare'
  | 'analyze'
  | 'explain'
  | 'report';

export interface DocumentActionDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly description: string;
  readonly result: string;
  readonly instruction: string;
  readonly action: DocumentActionType | null;
  readonly source_chat_id: number;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface DocumentActionListItemDto {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly source_chat_id: number;
  readonly instruction: string;
  readonly action: DocumentActionType | null;
  readonly created_by: number;
  readonly created_at: IsoDateTimeString;
}

export interface GenerateDocumentActionBody extends GenerationContextFields {
  readonly document_ids: readonly number[];
  readonly instruction: string;
  readonly action?: DocumentActionType | null;
  readonly chat_id: number;
}

export interface DocumentActionGenerateResponseDto {
  readonly document_action: DocumentActionDto;
  readonly fragments: readonly GenerateFragmentDto[];
}

export type AuraChatAiMode = 'document_question' | 'general_chat' | 'rag_agent';

export const AURA_CHAT_AI_MODE_DEFAULT: AuraChatAiMode = 'document_question';

export type AuraChatWsClientMessage =
  | {
      readonly type: 'chat.message';
      readonly message: string;
      readonly mode?: AuraChatAiMode;
      readonly document_ids?: readonly number[];
      readonly retrieve_context?: boolean | null;
      readonly process_documents?: boolean | null;
    }
  | { readonly type: 'chat.regenerate'; readonly mode?: AuraChatAiMode }
  | { readonly type: 'chat.typing'; readonly is_typing: boolean }
  | { readonly type: 'peer.message'; readonly message: string }
  | { readonly type: 'peer.message.edit'; readonly id: number; readonly message: string }
  | { readonly type: 'peer.message.delete'; readonly id: number }
  | { readonly type: 'peer.typing'; readonly is_typing: boolean };

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
  | { readonly type: 'member_left'; readonly member_id: number }
  | {
      readonly type: 'artifact_created';
      readonly artifact_id: number;
      readonly artifact_type: ArtifactType;
      readonly title: string;
      readonly created_by: number;
      readonly created_at: IsoDateTimeString;
    }
  | {
      readonly type: 'artifact_updated';
      readonly artifact_id: number;
      readonly artifact_type: ArtifactType;
      readonly title: string;
      readonly updated_by: number | null;
    }
  | {
      readonly type: 'artifact_deleted';
      readonly artifact_id: number;
      readonly deleted_by: number | null;
    }
  | {
      readonly type: 'peer_message_created';
      readonly id: number;
      readonly chat_id: number;
      readonly message: string;
      readonly created_by: number;
      readonly created_at: IsoDateTimeString;
      readonly updated_at: IsoDateTimeString | null;
      readonly is_edited: boolean;
    }
  | {
      readonly type: 'peer_message_updated';
      readonly id: number;
      readonly chat_id: number;
      readonly message: string;
      readonly created_by: number;
      readonly created_at: IsoDateTimeString;
      readonly updated_at: IsoDateTimeString | null;
      readonly is_edited: boolean;
    }
  | {
      readonly type: 'peer_message_deleted';
      readonly id: number;
      readonly deleted_by: number | null;
    }
  | {
      readonly type: 'peer_typing';
      readonly user_id: number;
      readonly is_typing: boolean;
    };
