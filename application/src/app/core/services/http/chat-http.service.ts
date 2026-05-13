import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AddMembersRequest,
  ChatApiMessage,
  ChatDetail,
  ChatDetailApiRow,
  ChatListApiRow,
  ChatMembershipRow,
  CreateChatRequest,
  CreateMessageRequest,
  CreateShareLinkRequest,
  CreateWebhookRequest,
  DrfCursorPage,
  DrfNumberedPage,
  MessageFeedbackRow,
  PaginatedChatsResponse,
  PaginatedMembershipsResponse,
  PaginatedMessagesResponse,
  PaginatedPinnedMessagesResponse,
  PaginatedShareLinksResponse,
  PaginatedWebhooksResponse,
  PatchChatRequest,
  PatchWebhookRequest,
  PinnedMessageApiRow,
  PinnedMessageRow,
  RegenerateResponse,
  SendMessageResponse,
  ShareLinkRow,
  ThreadReplyRow,
  UpdateMemberRequest,
  UpdateMemberRoleRequest,
  WebhookCreateRow,
  WebhookRow,
} from '@core/models/types/chat.types';
import {
  mapChatDetailApiToDetail,
  mapDrfCursorPageToMessages,
  mapDrfNumberedPageToChats,
  mapDrfNumberedPageToMemberships,
  mapDrfNumberedPageToPinnedMessages,
  mapDrfNumberedPageToPublicMessages,
  mapDrfNumberedPageToShareLinks,
  mapDrfNumberedPageToWebhooks,
  mapPinnedMessageApiRow,
  normalizeMessageRow,
  sortMessagesChronological,
} from '@core/models/chat-mappers';

export type ListChatsQuery = {
  url?: string;
  page?: number;
  page_size?: number;
};

export type ListMessagesQuery = {
  url?: string;
  cursor?: string | null;
  page_size?: number;
};

@Injectable({ providedIn: 'root' })
export class ChatHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.chatApiUrl}/api/v1`;

  listChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    if (query.url) {
      return this.http.get<DrfNumberedPage<ChatListApiRow>>(query.url).pipe(map(mapDrfNumberedPageToChats));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ChatListApiRow>>(`${this.base}/chats/`, { params })
      .pipe(map(mapDrfNumberedPageToChats));
  }

  listMyChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    if (query.url) {
      return this.http.get<DrfNumberedPage<ChatListApiRow>>(query.url).pipe(map(mapDrfNumberedPageToChats));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ChatListApiRow>>(`${this.base}/chats/me/`, { params })
      .pipe(map(mapDrfNumberedPageToChats));
  }

  createChat(body: CreateChatRequest): Observable<ChatDetail> {
    const payload = {
      name: body.name,
      system_prompt: body.system_prompt,
      response_style: body.response_style,
    };
    return this.http
      .post<ChatDetailApiRow>(`${this.base}/chats/`, payload)
      .pipe(map(mapChatDetailApiToDetail));
  }

  getChat(chatId: number): Observable<ChatDetail> {
    return this.http
      .get<ChatDetailApiRow>(`${this.base}/chats/${chatId}/`)
      .pipe(map(mapChatDetailApiToDetail));
  }

  patchChat(chatId: number, body: PatchChatRequest): Observable<ChatDetail> {
    return this.http
      .patch<ChatDetailApiRow>(`${this.base}/chats/${chatId}/`, body)
      .pipe(map(mapChatDetailApiToDetail));
  }

  deleteChat(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}/`).pipe(map(() => undefined));
  }

  listMessages(chatId: number, query: ListMessagesQuery = {}): Observable<PaginatedMessagesResponse> {
    if (query.url) {
      return this.http
        .get<DrfCursorPage<ChatApiMessage>>(query.url)
        .pipe(map((p) => mapDrfCursorPageToMessages(p, chatId)));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 50));
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    return this.http
      .get<DrfCursorPage<ChatApiMessage>>(`${this.base}/chats/${chatId}/messages/`, { params })
      .pipe(map((p) => mapDrfCursorPageToMessages(p, chatId)));
  }

  listAllMessagesChronological(chatId: number, pageSize = 50): Observable<ChatApiMessage[]> {
    const accumulate = async (): Promise<ChatApiMessage[]> => {
      const out: ChatApiMessage[] = [];
      let nextUrl: string | undefined;
      let first = true;
      while (first || nextUrl) {
        const page = await firstValueFrom(
          this.listMessages(chatId, first ? { page_size: pageSize } : { url: nextUrl! })
        );
        first = false;
        out.push(...page.data);
        nextUrl = page.pagination.next_cursor ?? undefined;
        if (!nextUrl) break;
      }
      return sortMessagesChronological(out);
    };
    return new Observable((sub) => {
      void accumulate()
        .then((msgs) => {
          sub.next(msgs);
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  createMessage(chatId: number, body: CreateMessageRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(`${this.base}/chats/${chatId}/messages/`, body);
  }

  deleteMessage(chatId: number, messageId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/messages/${messageId}/`)
      .pipe(map(() => undefined));
  }

  listMembers(chatId: number, query: ListChatsQuery = {}): Observable<PaginatedMembershipsResponse> {
    if (query.url) {
      return this.http
        .get<DrfNumberedPage<ChatMembershipRow>>(query.url)
        .pipe(map(mapDrfNumberedPageToMemberships));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ChatMembershipRow>>(`${this.base}/chats/${chatId}/members/`, { params })
      .pipe(map(mapDrfNumberedPageToMemberships));
  }

  addMembers(chatId: number, body: AddMembersRequest): Observable<ChatMembershipRow[]> {
    return this.http.post<ChatMembershipRow[]>(`${this.base}/chats/${chatId}/members/`, body);
  }

  patchMember(chatId: number, memberId: number, body: UpdateMemberRequest): Observable<ChatMembershipRow> {
    return this.http.patch<ChatMembershipRow>(
      `${this.base}/chats/${chatId}/members/${memberId}/`,
      body
    );
  }

  removeMember(chatId: number, memberId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/members/${memberId}/`)
      .pipe(map(() => undefined));
  }

  leaveChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/${chatId}/members/leave/`, {}).pipe(map(() => undefined));
  }

  archiveChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/archive/`, { ids: [chatId] }).pipe(map(() => undefined));
  }

  unarchiveChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/unarchive/`, { ids: [chatId] }).pipe(map(() => undefined));
  }

  listArchivedChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    if (query.url) {
      return this.http.get<DrfNumberedPage<ChatListApiRow>>(query.url).pipe(map(mapDrfNumberedPageToChats));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ChatListApiRow>>(`${this.base}/chats/archived/`, { params })
      .pipe(map(mapDrfNumberedPageToChats));
  }

  pinChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/${chatId}/pin/`, {}).pipe(map(() => undefined));
  }

  unpinChat(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}/pin/`).pipe(map(() => undefined));
  }

  lockChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/${chatId}/lock/`, {}).pipe(map(() => undefined));
  }

  unlockChat(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}/lock/`).pipe(map(() => undefined));
  }

  muteChat(chatId: number, mutedUntil: string): Observable<void> {
    return this.http
      .post(`${this.base}/chats/${chatId}/mute/`, { muted_until: mutedUntil })
      .pipe(map(() => undefined));
  }

  unmuteChat(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}/mute/`).pipe(map(() => undefined));
  }

  markChatAsRead(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/${chatId}/messages/read/`, {}).pipe(map(() => undefined));
  }

  clearHistory(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}/messages/clear/`).pipe(map(() => undefined));
  }

  regenerateResponse(chatId: number): Observable<RegenerateResponse> {
    return this.http.post<RegenerateResponse>(`${this.base}/chats/${chatId}/messages/regenerate/`, {});
  }

  bookmarkMessage(chatId: number, messageId: number): Observable<void> {
    return this.http
      .post(`${this.base}/chats/${chatId}/messages/${messageId}/bookmark/`, {})
      .pipe(map(() => undefined));
  }

  unbookmarkMessage(chatId: number, messageId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/messages/${messageId}/bookmark/`)
      .pipe(map(() => undefined));
  }

  listBookmarkedMessages(chatId: number, query: ListMessagesQuery = {}): Observable<PaginatedMessagesResponse> {
    if (query.url) {
      return this.http
        .get<DrfCursorPage<ChatApiMessage>>(query.url)
        .pipe(map((p) => mapDrfCursorPageToMessages(p, chatId)));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 50));
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    return this.http
      .get<DrfCursorPage<ChatApiMessage>>(`${this.base}/chats/${chatId}/messages/bookmarked/`, { params })
      .pipe(map((p) => mapDrfCursorPageToMessages(p, chatId)));
  }

  listPinnedMessages(chatId: number, query: ListChatsQuery = {}): Observable<PaginatedPinnedMessagesResponse> {
    if (query.url) {
      return this.http
        .get<DrfNumberedPage<PinnedMessageApiRow>>(query.url)
        .pipe(map((p) => mapDrfNumberedPageToPinnedMessages(p, chatId)));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<PinnedMessageApiRow>>(`${this.base}/chats/${chatId}/messages/pinned/`, { params })
      .pipe(map((p) => mapDrfNumberedPageToPinnedMessages(p, chatId)));
  }

  pinMessage(chatId: number, messageId: number): Observable<PinnedMessageRow> {
    return this.http
      .post<PinnedMessageApiRow>(`${this.base}/chats/${chatId}/messages/${messageId}/pin/`, {})
      .pipe(map((row) => mapPinnedMessageApiRow(row, chatId)));
  }

  unpinMessage(chatId: number, messageId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/messages/${messageId}/pin/`)
      .pipe(map(() => undefined));
  }

  getMessageThread(chatId: number, messageId: number): Observable<ThreadReplyRow[]> {
    return this.http.get<ThreadReplyRow[]>(
      `${this.base}/chats/${chatId}/messages/${messageId}/thread/`
    );
  }

  addThreadReply(chatId: number, messageId: number, message: string): Observable<ThreadReplyRow> {
    return this.http.post<ThreadReplyRow>(
      `${this.base}/chats/${chatId}/messages/${messageId}/thread/`,
      { message }
    );
  }

  setMessageFeedback(chatId: number, messageId: number, value: 1 | -1): Observable<MessageFeedbackRow> {
    return this.http.post<MessageFeedbackRow>(
      `${this.base}/chats/${chatId}/messages/${messageId}/feedback/`,
      { value }
    );
  }

  deleteMessageFeedback(chatId: number, messageId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/messages/${messageId}/feedback/`)
      .pipe(map(() => undefined));
  }

  updateMemberRole(chatId: number, memberId: number, body: UpdateMemberRoleRequest): Observable<ChatMembershipRow> {
    return this.http.patch<ChatMembershipRow>(
      `${this.base}/chats/${chatId}/members/${memberId}/role/`,
      body
    );
  }

  exportChatPDF(chatId: number): Observable<Blob> {
    return this.http.get(`${this.base}/chats/${chatId}/messages/export/pdf/`, { responseType: 'blob' });
  }

  exportChatMarkdown(chatId: number): Observable<Blob> {
    return this.http.get(`${this.base}/chats/${chatId}/messages/export/markdown/`, { responseType: 'blob' });
  }

  exportChatJSON(chatId: number): Observable<Blob> {
    return this.http.get(`${this.base}/chats/${chatId}/messages/export/json/`, { responseType: 'blob' });
  }

  exportAIResponses(chatId: number): Observable<Blob> {
    return this.http.get(`${this.base}/chats/${chatId}/messages/export/ai/`, { responseType: 'blob' });
  }

  exportMessagePDF(chatId: number, messageId: number): Observable<Blob> {
    return this.http.get(
      `${this.base}/chats/${chatId}/messages/${messageId}/export/pdf/`,
      { responseType: 'blob' }
    );
  }

  listShareLinks(chatId: number, query: ListChatsQuery = {}): Observable<PaginatedShareLinksResponse> {
    if (query.url) {
      return this.http
        .get<DrfNumberedPage<ShareLinkRow>>(query.url)
        .pipe(map(mapDrfNumberedPageToShareLinks));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ShareLinkRow>>(`${this.base}/chats/${chatId}/share-links/`, { params })
      .pipe(map(mapDrfNumberedPageToShareLinks));
  }

  createShareLink(chatId: number, body: CreateShareLinkRequest = {}): Observable<ShareLinkRow> {
    return this.http.post<ShareLinkRow>(`${this.base}/chats/${chatId}/share-links/`, body);
  }

  revokeShareLink(chatId: number, linkId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/share-links/${linkId}/`)
      .pipe(map(() => undefined));
  }

  listWebhooks(chatId: number, query: ListChatsQuery = {}): Observable<PaginatedWebhooksResponse> {
    if (query.url) {
      return this.http
        .get<DrfNumberedPage<WebhookRow>>(query.url)
        .pipe(map(mapDrfNumberedPageToWebhooks));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<WebhookRow>>(`${this.base}/chats/${chatId}/webhooks/`, { params })
      .pipe(map(mapDrfNumberedPageToWebhooks));
  }

  createWebhook(chatId: number, body: CreateWebhookRequest): Observable<WebhookCreateRow> {
    return this.http.post<WebhookCreateRow>(`${this.base}/chats/${chatId}/webhooks/`, body);
  }

  patchWebhook(chatId: number, webhookId: number, body: PatchWebhookRequest): Observable<WebhookRow> {
    return this.http.patch<WebhookRow>(`${this.base}/chats/${chatId}/webhooks/${webhookId}/`, body);
  }

  deleteWebhook(chatId: number, webhookId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/webhooks/${webhookId}/`)
      .pipe(map(() => undefined));
  }

  getPublicMessages(token: string, query: ListChatsQuery = {}): Observable<PaginatedMessagesResponse> {
    const shareBase = `${environment.chatApiUrl}/api/v1/share/${token}/messages/`;
    if (query.url) {
      return this.http
        .get<DrfNumberedPage<ChatApiMessage>>(query.url)
        .pipe(map((p) => mapDrfNumberedPageToPublicMessages(p)));
    }
    let params = new HttpParams().set('page_size', String(query.page_size ?? 20));
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    return this.http
      .get<DrfNumberedPage<ChatApiMessage>>(shareBase, { params })
      .pipe(map((p) => mapDrfNumberedPageToPublicMessages(p)));
  }
}
