import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscriber, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthenticationService } from '../authentication/authentication.service';
import type {
  ChatApiMessage,
  ChatDetail,
  ChatStreamCompletePayload,
  ChatStreamDeltaPayload,
  ChatStreamErrorPayload,
  ChatStreamEvent,
  ChatStreamRequest,
  ChatStreamStartPayload,
  CreateChatRequest,
  CreateMessageRequest,
  PaginatedChatsResponse,
  PaginatedMessagesResponse,
  PatchChatRequest,
} from '@core/models/types/chat.types';

export type ListChatsQuery = {
  limit?: number;
  cursor?: string | null;
};

export type ListMessagesQuery = {
  limit?: number;
  include_deleted?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ChatHttpService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthenticationService);
  private readonly base = `${environment.chatApiUrl}/api/v1`;

  listChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    let params = new HttpParams();
    const limit = query.limit ?? 20;
    params = params.set('limit', String(limit));
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    return this.http.get<PaginatedChatsResponse>(`${this.base}/chats`, { params });
  }

  createChat(body: CreateChatRequest): Observable<ChatDetail> {
    return this.http.post<ChatDetail>(`${this.base}/chats`, body);
  }

  getChat(chatId: number): Observable<ChatDetail> {
    return this.http.get<ChatDetail>(`${this.base}/chats/${chatId}`);
  }

  patchChat(chatId: number, body: PatchChatRequest): Observable<ChatDetail> {
    return this.http.patch<ChatDetail>(`${this.base}/chats/${chatId}`, body);
  }

  deleteChat(chatId: number): Observable<void> {
    return this.http.delete(`${this.base}/chats/${chatId}`).pipe(map(() => undefined));
  }

  listMessages(chatId: number, query: ListMessagesQuery = {}): Observable<PaginatedMessagesResponse> {
    let params = new HttpParams();
    params = params.set('limit', String(query.limit ?? 50));
    params = params.set('include_deleted', String(query.include_deleted ?? false));
    return this.http.get<PaginatedMessagesResponse>(`${this.base}/chats/${chatId}/messages`, {
      params,
    });
  }

  createMessage(chatId: number, body: CreateMessageRequest): Observable<ChatApiMessage> {
    return this.http.post<ChatApiMessage>(`${this.base}/chats/${chatId}/messages`, body);
  }

  getMessage(chatId: number, messageId: number): Observable<ChatApiMessage> {
    return this.http.get<ChatApiMessage>(
      `${this.base}/chats/${chatId}/messages/${messageId}`
    );
  }

  deleteMessage(chatId: number, messageId: number): Observable<void> {
    return this.http
      .delete(`${this.base}/chats/${chatId}/messages/${messageId}`)
      .pipe(map(() => undefined));
  }

  streamMessage(chatId: number, body: ChatStreamRequest): Observable<ChatStreamEvent> {
    return new Observable((subscriber: Subscriber<ChatStreamEvent>) => {
      const abort = new AbortController();
      const token = this.auth.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      void (async () => {
        try {
          const response = await fetch(
            `${this.base}/chats/${chatId}/messages/stream`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
              signal: abort.signal,
            }
          );
          if (!response.ok) {
            subscriber.error(new Error(`Stream failed: HTTP ${response.status}`));
            return;
          }
          const reader = response.body?.getReader();
          if (!reader) {
            subscriber.error(new Error('No response body'));
            return;
          }
          const decoder = new TextDecoder();
          let carry = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            carry += decoder.decode(value, { stream: true });
            const blocks = carry.split('\n\n');
            carry = blocks.pop() ?? '';
            for (const block of blocks) {
              const parsed = parseSseBlock(block);
              if (parsed) {
                subscriber.next(parsed);
                if (parsed.event === 'error') {
                  subscriber.complete();
                  return;
                }
              }
            }
          }
          subscriber.complete();
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            subscriber.error(e);
          }
        }
      })();

      return () => abort.abort();
    });
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!eventName || dataLines.length === 0) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return null;
  }
  switch (eventName) {
    case 'start':
      return { event: 'start', data: data as ChatStreamStartPayload };
    case 'delta':
      return { event: 'delta', data: data as ChatStreamDeltaPayload };
    case 'complete':
      return { event: 'complete', data: data as ChatStreamCompletePayload };
    case 'error':
      return { event: 'error', data: data as ChatStreamErrorPayload };
    default:
      return null;
  }
}
