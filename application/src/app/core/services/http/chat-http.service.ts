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
  DrfCursorPage,
  DrfNumberedPage,
  PaginatedChatsResponse,
  PaginatedMembershipsResponse,
  PaginatedMessagesResponse,
  PatchChatRequest,
  SendMessageResponse,
  UpdateMemberRequest,
} from '@core/models/types/chat.types';
import {
  mapChatDetailApiToDetail,
  mapDrfCursorPageToMessages,
  mapDrfNumberedPageToChats,
  mapDrfNumberedPageToMemberships,
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

  getMessage(chatId: number, messageId: number): Observable<ChatApiMessage> {
    return this.http
      .get<ChatApiMessage>(`${this.base}/chats/${chatId}/messages/${messageId}/`)
      .pipe(map((m) => normalizeMessageRow(m, chatId)));
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
    return this.http.post(`${this.base}/chats/${chatId}/archive/`, {}).pipe(map(() => undefined));
  }

  unarchiveChat(chatId: number): Observable<void> {
    return this.http.post(`${this.base}/chats/${chatId}/unarchive/`, {}).pipe(map(() => undefined));
  }
}
