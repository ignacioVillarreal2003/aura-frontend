import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type {
  AddMembersBody,
  ArtifactDetailDto,
  ArtifactSummaryDto,
  ArtifactVersionDto,
  AssistantAdminDto,
  AssistantDto,
  BulkArchiveChatResultDto,
  BulkChatIdsBody,
  BulkUnarchiveChatResultDto,
  ChatDetailDto,
  ChatListItemDto,
  ChatListQueryParams,
  ChecklistDto,
  ChecklistGenerateResponseDto,
  ChecklistListItemDto,
  CreateAssistantBody,
  CreateChatBody,
  CursorPageResult,
  CursorPaginationQueryParams,
  DecisionBriefDto,
  DecisionBriefGenerateResponseDto,
  DecisionBriefListItemDto,
  DocumentActionDto,
  DocumentActionGenerateResponseDto,
  DocumentActionListItemDto,
  DocumentSummaryDto,
  DocumentSummaryGenerateResponseDto,
  DocumentSummaryListItemDto,
  FeedbackAnalyticsDto,
  FeedbackAnalyticsQuery,
  GenerateChecklistBody,
  GenerateDecisionBriefBody,
  GenerateDocumentActionBody,
  GenerateDocumentSummaryBody,
  GenerateLessonsLearnedBody,
  GenerateQuizBody,
  GenerateReportBody,
  GenerateTimelineBody,
  HealthResponseDto,
  LessonsLearnedDto,
  LessonsLearnedGenerateResponseDto,
  LessonsLearnedListItemDto,
  MemberListQueryParams,
  MembershipDto,
  MessageDto,
  MuteChatBody,
  PageNumberResult,
  PinnedArtifactDto,
  QuizDto,
  QuizGenerateResponseDto,
  QuizListItemDto,
  ReportDto,
  ReportGenerateResponseDto,
  ReportListItemDto,
  SendMessageResponseDto,
  SendMessageTextJsonBody,
  SendThreadReplyBody,
  SetFeedbackBody,
  ShareLinkCreateBody,
  ShareLinkDto,
  ThreadReplyDto,
  TimelineDto,
  TimelineGenerateResponseDto,
  TimelineListItemDto,
  UpdateChatBody,
  StartChatResponseDto,
  UpdateAssistantBody,
  UpdateChecklistBody,
  UpdateDecisionBriefBody,
  UpdateDocumentActionBody,
  UpdateDocumentSummaryBody,
  UpdateLessonsLearnedBody,
  UpdateMemberRoleBody,
  UpdateMemberStatusBody,
  UpdateQuizBody,
  UpdateReportBody,
  UpdateTimelineBody,
} from '@aura-types/aura-chat-service.types';

interface PageFollowQuery {
  readonly url?: string;
  readonly page?: number;
  readonly page_size?: number;
}

interface CursorFollowQuery extends CursorPaginationQueryParams {
  readonly url?: string;
}

@Injectable({ providedIn: 'root' })
export class AuraChatServiceHttp {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.chatApiUrl}/api/v1`;

  private chatsRoot(): string {
    return `${this.base}/chats/`;
  }

  private chatDetail(chatId: number): string {
    return `${this.base}/chats/${chatId}/`;
  }

  private artifactsBase(): string {
    return `${this.base}/artifacts/`;
  }

  private membersRoot(chatId: number): string {
    return `${this.base}/chats/${chatId}/members/`;
  }

  health(): Observable<HttpResponse<HealthResponseDto>> {
    return this.http.get<HealthResponseDto>(`${this.base}/health`, {
      observe: 'response',
    });
  }

  listChats(
    query: ChatListQueryParams & PageFollowQuery = {},
  ): Observable<PageNumberResult<ChatListItemDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ChatListItemDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ChatListItemDto>>(this.chatsRoot(), {
      params: this.paramsForChatList(query),
    });
  }

  createChat(body: CreateChatBody): Observable<ChatDetailDto> {
    return this.http.post<ChatDetailDto>(this.chatsRoot(), body);
  }

  getChat(chatId: number): Observable<ChatDetailDto> {
    return this.http.get<ChatDetailDto>(this.chatDetail(chatId));
  }

  patchChat(chatId: number, body: UpdateChatBody): Observable<ChatDetailDto> {
    return this.http.patch<ChatDetailDto>(this.chatDetail(chatId), body);
  }

  deleteChat(chatId: number): Observable<void> {
    return this.http.delete<void>(this.chatDetail(chatId));
  }

  listMyChats(
    query: ChatListQueryParams & PageFollowQuery = {},
  ): Observable<PageNumberResult<ChatListItemDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ChatListItemDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ChatListItemDto>>(`${this.chatsRoot()}me/`, {
      params: this.paramsForChatList(query),
    });
  }

  pinChat(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.chatDetail(chatId)}pin/`, {});
  }

  unpinChat(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}pin/`);
  }

  listArchivedChats(
    query: ChatListQueryParams & PageFollowQuery = {},
  ): Observable<PageNumberResult<ChatListItemDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ChatListItemDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ChatListItemDto>>(`${this.chatsRoot()}archived/`, {
      params: this.paramsForChatList(query),
    });
  }

  archiveChats(body: BulkChatIdsBody): Observable<BulkArchiveChatResultDto> {
    return this.http.post<BulkArchiveChatResultDto>(`${this.chatsRoot()}archive/`, body);
  }

  unarchiveChats(body: BulkChatIdsBody): Observable<BulkUnarchiveChatResultDto> {
    return this.http.post<BulkUnarchiveChatResultDto>(`${this.chatsRoot()}unarchive/`, body);
  }

  lockChat(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.chatDetail(chatId)}lock/`, {});
  }

  unlockChat(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}lock/`);
  }

  muteChat(chatId: number, body: MuteChatBody): Observable<void> {
    return this.http.post<void>(`${this.chatDetail(chatId)}mute/`, body);
  }

  unmuteChat(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}mute/`);
  }

  listShareLinks(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<ShareLinkDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ShareLinkDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ShareLinkDto>>(
      `${this.chatDetail(chatId)}share-links/`,
      { params: this.paramsForPaging(query) },
    );
  }

  createShareLink(chatId: number, body: ShareLinkCreateBody = {}): Observable<ShareLinkDto> {
    return this.http.post<ShareLinkDto>(`${this.chatDetail(chatId)}share-links/`, body);
  }

  revokeShareLink(chatId: number, linkId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}share-links/${linkId}/`);
  }

  listMessages(
    chatId: number,
    query: CursorFollowQuery = {},
  ): Observable<CursorPageResult<MessageDto>> {
    if (query.url) {
      return this.http.get<CursorPageResult<MessageDto>>(query.url);
    }
    let p = this.paramsForCursor(query);
    p = p.set('chat_id', String(chatId));
    return this.http.get<CursorPageResult<MessageDto>>(`${this.base}/messages/`, { params: p });
  }

  listChatArtifacts(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<ArtifactSummaryDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ArtifactSummaryDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ArtifactSummaryDto>>(
      `${this.artifactsBase()}chats/${chatId}/`,
      { params: this.paramsForPaging(query) },
    );
  }

  sendMessageJson(
    chatId: number,
    body: SendMessageTextJsonBody,
  ): Observable<SendMessageResponseDto> {
    return this.http.post<SendMessageResponseDto>(`${this.base}/messages/generate/`, {
      ...body,
      chat_id: chatId,
    });
  }

  sendMessageMultipart(chatId: number, formData: FormData): Observable<SendMessageResponseDto> {
    formData.set('chat_id', String(chatId));
    return this.http.post<SendMessageResponseDto>(`${this.base}/messages/generate/`, formData);
  }

  transcribeAudio(chatId: number, formData: FormData): Observable<{ transcript: string }> {
    return this.http.post<{ transcript: string }>(`${this.chatDetail(chatId)}transcribe/`, formData);
  }

  clearChatHistory(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}clear/`);
  }

  markChatAsRead(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.chatDetail(chatId)}read/`, {});
  }

  listPinnedArtifacts(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<PinnedArtifactDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<PinnedArtifactDto>>(query.url);
    }
    let p = this.paramsForPaging(query);
    p = p.set('chat_id', String(chatId));
    return this.http.get<PageNumberResult<PinnedArtifactDto>>(
      `${this.artifactsBase()}pinned/`,
      { params: p },
    );
  }

  listBookmarkedArtifacts(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<ArtifactSummaryDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ArtifactSummaryDto>>(query.url);
    }
    let p = this.paramsForPaging(query);
    p = p.set('chat_id', String(chatId));
    return this.http.get<PageNumberResult<ArtifactSummaryDto>>(
      `${this.artifactsBase()}bookmarked/`,
      { params: p },
    );
  }

  exportChatPdf(chatId: number): Observable<Blob> {
    return this.http.get(`${this.chatDetail(chatId)}export/pdf/`, {
      responseType: 'blob',
    });
  }

  exportChatMarkdown(chatId: number): Observable<Blob> {
    return this.http.get(`${this.chatDetail(chatId)}export/markdown/`, {
      responseType: 'blob',
    });
  }

  deleteArtifact(artifactId: number): Observable<void> {
    return this.http.delete<void>(`${this.artifactsBase()}${artifactId}/`);
  }

  bookmarkArtifact(artifactId: number): Observable<void> {
    return this.http.post<void>(`${this.artifactsBase()}${artifactId}/bookmark/`, {});
  }

  unbookmarkArtifact(artifactId: number): Observable<void> {
    return this.http.delete<void>(`${this.artifactsBase()}${artifactId}/bookmark/`);
  }

  pinArtifact(artifactId: number): Observable<void> {
    return this.http.post<void>(`${this.artifactsBase()}${artifactId}/pin/`, {});
  }

  unpinArtifact(artifactId: number): Observable<void> {
    return this.http.delete<void>(`${this.artifactsBase()}${artifactId}/pin/`);
  }

  listArtifactThreadReplies(artifactId: number): Observable<PageNumberResult<ThreadReplyDto>> {
    return this.http.get<PageNumberResult<ThreadReplyDto>>(
      `${this.artifactsBase()}${artifactId}/thread/`,
    );
  }

  addArtifactThreadReply(artifactId: number, body: SendThreadReplyBody): Observable<ThreadReplyDto> {
    return this.http.post<ThreadReplyDto>(`${this.artifactsBase()}${artifactId}/thread/`, body);
  }

  setArtifactFeedback(artifactId: number, body: SetFeedbackBody): Observable<void> {
    return this.http.post<void>(`${this.artifactsBase()}${artifactId}/feedback/`, body);
  }

  deleteArtifactFeedback(artifactId: number): Observable<void> {
    return this.http.delete<void>(`${this.artifactsBase()}${artifactId}/feedback/`);
  }

  getFeedbackAnalytics(query: FeedbackAnalyticsQuery = {}): Observable<FeedbackAnalyticsDto> {
    let params = new HttpParams();
    if (query.days != null) {
      params = params.set('days', String(query.days));
    }
    return this.http.get<FeedbackAnalyticsDto>(`${this.artifactsBase()}feedback/analytics/`, { params });
  }

  getMessage(messageId: number): Observable<MessageDto> {
    return this.http.get<MessageDto>(`${this.base}/messages/${messageId}/`);
  }

  exportArtifactMessagePdf(messageId: number): Observable<Blob> {
    return this.http.get(
      `${this.base}/messages/${messageId}/export/pdf/`,
      { responseType: 'blob' },
    );
  }

  exportArtifactMessageMarkdown(messageId: number): Observable<Blob> {
    return this.http.get(
      `${this.base}/messages/${messageId}/export/markdown/`,
      { responseType: 'blob' },
    );
  }

  getArtifact(artifactId: number): Observable<ArtifactDetailDto> {
    return this.http.get<ArtifactDetailDto>(`${this.artifactsBase()}${artifactId}/`);
  }

  listArtifactVersions(
    artifactId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<ArtifactVersionDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<ArtifactVersionDto>>(query.url);
    }
    return this.http.get<PageNumberResult<ArtifactVersionDto>>(
      `${this.artifactsBase()}${artifactId}/versions/`,
      { params: this.paramsForPaging(query) },
    );
  }

  listMembers(
    chatId: number,
    query: MemberListQueryParams & PageFollowQuery = {},
  ): Observable<PageNumberResult<MembershipDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<MembershipDto>>(query.url);
    }
    return this.http.get<PageNumberResult<MembershipDto>>(this.membersRoot(chatId), {
      params: this.paramsForMemberList(query),
    });
  }

  addMembers(chatId: number, body: AddMembersBody): Observable<readonly MembershipDto[]> {
    return this.http
      .post<readonly MembershipDto[]>(this.membersRoot(chatId), body)
      .pipe(map((rows) => [...rows]));
  }

  getMember(chatId: number, memberId: number): Observable<MembershipDto> {
    return this.http.get<MembershipDto>(`${this.membersRoot(chatId)}${memberId}/`);
  }

  patchMember(
    chatId: number,
    memberId: number,
    body: UpdateMemberStatusBody,
  ): Observable<MembershipDto> {
    return this.http.patch<MembershipDto>(
      `${this.membersRoot(chatId)}${memberId}/`,
      body,
    );
  }

  removeMember(chatId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.membersRoot(chatId)}${memberId}/`);
  }

  leaveChat(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.membersRoot(chatId)}leave/`, {});
  }

  listMyMemberships(query: { status?: string; page?: number; page_size?: number } = {}): Observable<PageNumberResult<MembershipDto>> {
    let p = this.paramsForPaging(query);
    if (query.status) p = p.set('status', query.status);
    return this.http.get<PageNumberResult<MembershipDto>>(`${this.base}/memberships/me/`, { params: p });
  }

  patchMemberRole(
    chatId: number,
    memberId: number,
    body: UpdateMemberRoleBody,
  ): Observable<MembershipDto> {
    return this.http.patch<MembershipDto>(
      `${this.membersRoot(chatId)}${memberId}/role/`,
      body,
    );
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  listReports(query: { type?: string; chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<ReportListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.type) p = p.set('type', query.type);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<ReportListItemDto>>(`${this.base}/reports/`, { params: p });
  }

  generateReport(body: GenerateReportBody | FormData): Observable<ReportGenerateResponseDto> {
    return this.http.post<ReportGenerateResponseDto>(`${this.base}/reports/generate/`, body);
  }

  getReport(reportId: number): Observable<ReportDto> {
    return this.http.get<ReportDto>(`${this.base}/reports/${reportId}/`);
  }

  patchReport(reportId: number, body: UpdateReportBody): Observable<ReportDto> {
    return this.http.patch<ReportDto>(`${this.base}/reports/${reportId}/`, body);
  }

  deleteReport(reportId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/reports/${reportId}/`);
  }

  exportReportPdf(reportId: number): Observable<Blob> {
    return this.http.get(`${this.base}/reports/${reportId}/export/pdf/`, { responseType: 'blob' });
  }

  exportReportMarkdown(reportId: number): Observable<Blob> {
    return this.http.get(`${this.base}/reports/${reportId}/export/markdown/`, { responseType: 'blob' });
  }

  // ── Checklists ──────────────────────────────────────────────────────────────

  listChecklists(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<ChecklistListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<ChecklistListItemDto>>(`${this.base}/checklists/`, { params: p });
  }

  generateChecklist(body: GenerateChecklistBody | FormData): Observable<ChecklistGenerateResponseDto> {
    return this.http.post<ChecklistGenerateResponseDto>(`${this.base}/checklists/generate/`, body);
  }

  getChecklist(checklistId: number): Observable<ChecklistDto> {
    return this.http.get<ChecklistDto>(`${this.base}/checklists/${checklistId}/`);
  }

  patchChecklist(checklistId: number, body: UpdateChecklistBody): Observable<ChecklistDto> {
    return this.http.patch<ChecklistDto>(`${this.base}/checklists/${checklistId}/`, body);
  }

  deleteChecklist(checklistId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/checklists/${checklistId}/`);
  }

  exportChecklistPdf(checklistId: number): Observable<Blob> {
    return this.http.get(`${this.base}/checklists/${checklistId}/export/pdf/`, { responseType: 'blob' });
  }

  exportChecklistMarkdown(checklistId: number): Observable<Blob> {
    return this.http.get(`${this.base}/checklists/${checklistId}/export/markdown/`, { responseType: 'blob' });
  }

  // ── Quiz ────────────────────────────────────────────────────────────────────

  listQuizzes(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<QuizListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<QuizListItemDto>>(`${this.base}/quizzes/`, { params: p });
  }

  generateQuiz(body: GenerateQuizBody | FormData): Observable<QuizGenerateResponseDto> {
    return this.http.post<QuizGenerateResponseDto>(`${this.base}/quizzes/generate/`, body);
  }

  getQuiz(quizId: number): Observable<QuizDto> {
    return this.http.get<QuizDto>(`${this.base}/quizzes/${quizId}/`);
  }

  patchQuiz(quizId: number, body: UpdateQuizBody): Observable<QuizDto> {
    return this.http.patch<QuizDto>(`${this.base}/quizzes/${quizId}/`, body);
  }

  deleteQuiz(quizId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/quizzes/${quizId}/`);
  }

  exportQuizPdf(quizId: number): Observable<Blob> {
    return this.http.get(`${this.base}/quizzes/${quizId}/export/pdf/`, { responseType: 'blob' });
  }

  exportQuizMarkdown(quizId: number): Observable<Blob> {
    return this.http.get(`${this.base}/quizzes/${quizId}/export/markdown/`, { responseType: 'blob' });
  }

  // ── Timeline ─────────────────────────────────────────────────────────────────

  listTimelines(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<TimelineListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<TimelineListItemDto>>(`${this.base}/timelines/`, { params: p });
  }

  generateTimeline(body: GenerateTimelineBody | FormData): Observable<TimelineGenerateResponseDto> {
    return this.http.post<TimelineGenerateResponseDto>(`${this.base}/timelines/generate/`, body);
  }

  getTimeline(timelineId: number): Observable<TimelineDto> {
    return this.http.get<TimelineDto>(`${this.base}/timelines/${timelineId}/`);
  }

  patchTimeline(timelineId: number, body: UpdateTimelineBody): Observable<TimelineDto> {
    return this.http.patch<TimelineDto>(`${this.base}/timelines/${timelineId}/`, body);
  }

  deleteTimeline(timelineId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/timelines/${timelineId}/`);
  }

  exportTimelinePdf(timelineId: number): Observable<Blob> {
    return this.http.get(`${this.base}/timelines/${timelineId}/export/pdf/`, { responseType: 'blob' });
  }

  exportTimelineMarkdown(timelineId: number): Observable<Blob> {
    return this.http.get(`${this.base}/timelines/${timelineId}/export/markdown/`, { responseType: 'blob' });
  }

  // ── LessonsLearned ───────────────────────────────────────────────────────────

  listLessonsLearned(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<LessonsLearnedListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<LessonsLearnedListItemDto>>(`${this.base}/lessons-learned/`, { params: p });
  }

  generateLessonsLearned(body: GenerateLessonsLearnedBody | FormData): Observable<LessonsLearnedGenerateResponseDto> {
    return this.http.post<LessonsLearnedGenerateResponseDto>(`${this.base}/lessons-learned/generate/`, body);
  }

  getLessonsLearned(id: number): Observable<LessonsLearnedDto> {
    return this.http.get<LessonsLearnedDto>(`${this.base}/lessons-learned/${id}/`);
  }

  patchLessonsLearned(id: number, body: UpdateLessonsLearnedBody): Observable<LessonsLearnedDto> {
    return this.http.patch<LessonsLearnedDto>(`${this.base}/lessons-learned/${id}/`, body);
  }

  deleteLessonsLearned(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/lessons-learned/${id}/`);
  }

  exportLessonsLearnedPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lessons-learned/${id}/export/pdf/`, { responseType: 'blob' });
  }

  exportLessonsLearnedMarkdown(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lessons-learned/${id}/export/markdown/`, { responseType: 'blob' });
  }

  // ── DecisionBrief ────────────────────────────────────────────────────────────

  listDecisionBriefs(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<DecisionBriefListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<DecisionBriefListItemDto>>(`${this.base}/decision-briefs/`, { params: p });
  }

  generateDecisionBrief(body: GenerateDecisionBriefBody | FormData): Observable<DecisionBriefGenerateResponseDto> {
    return this.http.post<DecisionBriefGenerateResponseDto>(`${this.base}/decision-briefs/generate/`, body);
  }

  getDecisionBrief(id: number): Observable<DecisionBriefDto> {
    return this.http.get<DecisionBriefDto>(`${this.base}/decision-briefs/${id}/`);
  }

  patchDecisionBrief(id: number, body: UpdateDecisionBriefBody): Observable<DecisionBriefDto> {
    return this.http.patch<DecisionBriefDto>(`${this.base}/decision-briefs/${id}/`, body);
  }

  deleteDecisionBrief(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/decision-briefs/${id}/`);
  }

  exportDecisionBriefPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/decision-briefs/${id}/export/pdf/`, { responseType: 'blob' });
  }

  exportDecisionBriefMarkdown(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/decision-briefs/${id}/export/markdown/`, { responseType: 'blob' });
  }

  // ── DocumentSummary ──────────────────────────────────────────────────────────

  listDocumentSummaries(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<DocumentSummaryListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<DocumentSummaryListItemDto>>(`${this.base}/document-summaries/`, { params: p });
  }

  generateDocumentSummary(body: GenerateDocumentSummaryBody): Observable<DocumentSummaryGenerateResponseDto> {
    return this.http.post<DocumentSummaryGenerateResponseDto>(`${this.base}/document-summaries/generate/`, body);
  }

  getDocumentSummary(id: number): Observable<DocumentSummaryDto> {
    return this.http.get<DocumentSummaryDto>(`${this.base}/document-summaries/${id}/`);
  }

  patchDocumentSummary(id: number, body: UpdateDocumentSummaryBody): Observable<DocumentSummaryDto> {
    return this.http.patch<DocumentSummaryDto>(`${this.base}/document-summaries/${id}/`, body);
  }

  deleteDocumentSummary(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/document-summaries/${id}/`);
  }

  exportDocumentSummaryPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/document-summaries/${id}/export/pdf/`, { responseType: 'blob' });
  }

  exportDocumentSummaryMarkdown(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/document-summaries/${id}/export/markdown/`, { responseType: 'blob' });
  }

  // ── DocumentAction ───────────────────────────────────────────────────────────

  listDocumentActions(query: { chat_id?: number; page?: number; page_size?: number } = {}): Observable<PageNumberResult<DocumentActionListItemDto>> {
    let p = this.paramsForPaging(query);
    if (query.chat_id != null) p = p.set('chat_id', String(query.chat_id));
    return this.http.get<PageNumberResult<DocumentActionListItemDto>>(`${this.base}/document-actions/`, { params: p });
  }

  generateDocumentAction(body: GenerateDocumentActionBody): Observable<DocumentActionGenerateResponseDto> {
    return this.http.post<DocumentActionGenerateResponseDto>(`${this.base}/document-actions/generate/`, body);
  }

  getDocumentAction(id: number): Observable<DocumentActionDto> {
    return this.http.get<DocumentActionDto>(`${this.base}/document-actions/${id}/`);
  }

  patchDocumentAction(id: number, body: UpdateDocumentActionBody): Observable<DocumentActionDto> {
    return this.http.patch<DocumentActionDto>(`${this.base}/document-actions/${id}/`, body);
  }

  deleteDocumentAction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/document-actions/${id}/`);
  }

  exportDocumentActionPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/document-actions/${id}/export/pdf/`, { responseType: 'blob' });
  }

  exportDocumentActionMarkdown(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/document-actions/${id}/export/markdown/`, { responseType: 'blob' });
  }

  // ── Assistants ──────────────────────────────────────────────────────────────

  listAssistants(query: { page?: number; page_size?: number; search?: string } = {}): Observable<PageNumberResult<AssistantDto>> {
    let p = this.paramsForPaging(query);
    if (query.search) p = p.set('search', query.search);
    return this.http.get<PageNumberResult<AssistantDto>>(`${this.base}/assistants/`, { params: p });
  }

  listAssistantsAdmin(query: { page?: number; page_size?: number } = {}): Observable<PageNumberResult<AssistantAdminDto>> {
    const p = this.paramsForPaging(query);
    return this.http.get<PageNumberResult<AssistantAdminDto>>(`${this.base}/assistants/manage/`, { params: p });
  }

  createAssistant(body: CreateAssistantBody): Observable<AssistantAdminDto> {
    return this.http.post<AssistantAdminDto>(`${this.base}/assistants/`, body);
  }

  getAssistant(assistantId: number): Observable<AssistantDto> {
    return this.http.get<AssistantDto>(`${this.base}/assistants/${assistantId}/`);
  }

  patchAssistant(assistantId: number, body: UpdateAssistantBody): Observable<AssistantAdminDto> {
    return this.http.patch<AssistantAdminDto>(`${this.base}/assistants/${assistantId}/`, body);
  }

  deleteAssistant(assistantId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/assistants/${assistantId}/`);
  }

  startAssistantChat(assistantId: number, body: { resume?: boolean } = {}): Observable<StartChatResponseDto> {
    return this.http.post<StartChatResponseDto>(`${this.base}/assistants/${assistantId}/start-chat/`, body);
  }

  listPublicShareMessages(
    token: string,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<MessageDto>> {
    const root = `${this.base}/share/${token}/messages/`;
    if (query.url) {
      return this.http.get<PageNumberResult<MessageDto>>(query.url);
    }
    return this.http.get<PageNumberResult<MessageDto>>(root, {
      params: this.paramsForPaging(query),
    });
  }

  private paramsForChatList(q: ChatListQueryParams & PageFollowQuery): HttpParams {
    let p = this.paramsForPaging(q);
    if (q.search != null && q.search !== '') {
      p = p.set('search', q.search);
    }
    if (q.ordering != null) {
      p = p.set('ordering', q.ordering);
    }
    if (q.tags != null && q.tags !== '') {
      p = p.set('tags', q.tags);
    }
    return p;
  }

  private paramsForPaging(q: PageFollowQuery): HttpParams {
    let p = new HttpParams();
    if (q.page != null) {
      p = p.set('page', String(q.page));
    }
    if (q.page_size != null) {
      p = p.set('page_size', String(q.page_size));
    }
    return p;
  }

  private paramsForCursor(q: CursorFollowQuery): HttpParams {
    let p = new HttpParams();
    if (q.cursor != null && q.cursor !== '') {
      p = p.set('cursor', q.cursor);
    }
    if (q.page_size != null) {
      p = p.set('page_size', String(q.page_size));
    }
    return p;
  }

  private paramsForMemberList(q: MemberListQueryParams & PageFollowQuery): HttpParams {
    let p = this.paramsForPaging(q);
    if (q.status != null) {
      p = p.set('status', q.status);
    }
    return p;
  }
}
