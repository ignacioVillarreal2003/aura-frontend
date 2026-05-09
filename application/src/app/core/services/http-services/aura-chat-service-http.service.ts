import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type {
  AddMembersBody,
  BulkArchiveChatResultDto,
  BulkChatIdsBody,
  BulkUnarchiveChatResultDto,
  ChatDetailDto,
  ChatExportBackupDto,
  ChatListItemDto,
  ChatListQueryParams,
  CreateChatBody,
  CursorPageResult,
  CursorPaginationQueryParams,
  HealthResponseDto,
  MemberListQueryParams,
  MembershipDto,
  MessageDto,
  MessageFeedbackDto,
  MuteChatBody,
  PageNumberResult,
  PinnedMessageDto,
  RegenerateResponseDto,
  SendMessageResponseDto,
  SendMessageTextJsonBody,
  SendThreadReplyBody,
  SetFeedbackBody,
  ShareLinkCreateBody,
  ShareLinkDto,
  ThreadReplyDto,
  UpdateChatBody,
  UpdateMemberRoleBody,
  UpdateMemberStatusBody,
  WebhookCreateBody,
  WebhookCreatedDto,
  WebhookDto,
  WebhookPatchBody,
} from '@types/aura-chat-service.types';

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

  private messagesRoot(chatId: number): string {
    return `${this.base}/chats/${chatId}/messages/`;
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

  listWebhooks(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<WebhookDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<WebhookDto>>(query.url);
    }
    return this.http.get<PageNumberResult<WebhookDto>>(
      `${this.chatDetail(chatId)}webhooks/`,
      { params: this.paramsForPaging(query) },
    );
  }

  createWebhook(chatId: number, body: WebhookCreateBody): Observable<WebhookCreatedDto> {
    return this.http.post<WebhookCreatedDto>(`${this.chatDetail(chatId)}webhooks/`, body);
  }

  patchWebhook(
    chatId: number,
    webhookId: number,
    body: WebhookPatchBody,
  ): Observable<WebhookDto> {
    return this.http.patch<WebhookDto>(
      `${this.chatDetail(chatId)}webhooks/${webhookId}/`,
      body,
    );
  }

  deleteWebhook(chatId: number, webhookId: number): Observable<void> {
    return this.http.delete<void>(`${this.chatDetail(chatId)}webhooks/${webhookId}/`);
  }

  listMessages(
    chatId: number,
    query: CursorFollowQuery = {},
  ): Observable<CursorPageResult<MessageDto>> {
    if (query.url) {
      return this.http.get<CursorPageResult<MessageDto>>(query.url);
    }
    return this.http.get<CursorPageResult<MessageDto>>(this.messagesRoot(chatId), {
      params: this.paramsForCursor(query),
    });
  }

  sendMessageJson(
    chatId: number,
    body: SendMessageTextJsonBody,
  ): Observable<SendMessageResponseDto> {
    return this.http.post<SendMessageResponseDto>(this.messagesRoot(chatId), body);
  }

  sendMessageMultipart(chatId: number, formData: FormData): Observable<SendMessageResponseDto> {
    return this.http.post<SendMessageResponseDto>(this.messagesRoot(chatId), formData);
  }

  clearChatHistory(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.messagesRoot(chatId)}clear/`);
  }

  markChatAsRead(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.messagesRoot(chatId)}read/`, {});
  }

  listPinnedMessages(
    chatId: number,
    query: PageFollowQuery = {},
  ): Observable<PageNumberResult<PinnedMessageDto>> {
    if (query.url) {
      return this.http.get<PageNumberResult<PinnedMessageDto>>(query.url);
    }
    return this.http.get<PageNumberResult<PinnedMessageDto>>(
      `${this.messagesRoot(chatId)}pinned/`,
      { params: this.paramsForPaging(query) },
    );
  }

  regenerateAssistantResponse(chatId: number): Observable<RegenerateResponseDto> {
    return this.http.post<RegenerateResponseDto>(
      `${this.messagesRoot(chatId)}regenerate/`,
      {},
    );
  }

  listBookmarkedMessages(
    chatId: number,
    query: CursorFollowQuery = {},
  ): Observable<CursorPageResult<MessageDto>> {
    if (query.url) {
      return this.http.get<CursorPageResult<MessageDto>>(query.url);
    }
    return this.http.get<CursorPageResult<MessageDto>>(
      `${this.messagesRoot(chatId)}bookmarked/`,
      { params: this.paramsForCursor(query) },
    );
  }

  exportChatPdf(chatId: number): Observable<Blob> {
    return this.http.get(`${this.messagesRoot(chatId)}export/pdf/`, {
      responseType: 'blob',
    });
  }

  exportChatMarkdown(chatId: number): Observable<Blob> {
    return this.http.get(`${this.messagesRoot(chatId)}export/markdown/`, {
      responseType: 'blob',
    });
  }

  exportChatJsonBackup(chatId: number): Observable<ChatExportBackupDto> {
    return this.http.get<ChatExportBackupDto>(`${this.messagesRoot(chatId)}export/json/`);
  }

  exportAiResponsesMarkdown(chatId: number): Observable<Blob> {
    return this.http.get(`${this.messagesRoot(chatId)}export/ai/`, {
      responseType: 'blob',
    });
  }

  deleteMessage(chatId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.messagesRoot(chatId)}${messageId}/`);
  }

  bookmarkMessage(chatId: number, messageId: number): Observable<void> {
    return this.http.post<void>(`${this.messagesRoot(chatId)}${messageId}/bookmark/`, {});
  }

  unbookmarkMessage(chatId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.messagesRoot(chatId)}${messageId}/bookmark/`);
  }

  pinMessage(chatId: number, messageId: number): Observable<PinnedMessageDto> {
    return this.http.post<PinnedMessageDto>(
      `${this.messagesRoot(chatId)}${messageId}/pin/`,
      {},
    );
  }

  unpinMessage(chatId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.messagesRoot(chatId)}${messageId}/pin/`);
  }

  listThreadReplies(chatId: number, messageId: number): Observable<readonly ThreadReplyDto[]> {
    return this.http
      .get<readonly ThreadReplyDto[]>(`${this.messagesRoot(chatId)}${messageId}/thread/`)
      .pipe(map((rows) => [...rows]));
  }

  addThreadReply(
    chatId: number,
    messageId: number,
    body: SendThreadReplyBody,
  ): Observable<ThreadReplyDto> {
    return this.http.post<ThreadReplyDto>(
      `${this.messagesRoot(chatId)}${messageId}/thread/`,
      body,
    );
  }

  setMessageFeedback(
    chatId: number,
    messageId: number,
    body: SetFeedbackBody,
  ): Observable<MessageFeedbackDto> {
    return this.http.post<MessageFeedbackDto>(
      `${this.messagesRoot(chatId)}${messageId}/feedback/`,
      body,
    );
  }

  deleteMessageFeedback(chatId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.messagesRoot(chatId)}${messageId}/feedback/`);
  }

  exportMessagePdf(chatId: number, messageId: number): Observable<Blob> {
    return this.http.get(
      `${this.messagesRoot(chatId)}${messageId}/export/pdf/`,
      { responseType: 'blob' },
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
