import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ChatWsIncoming } from '@core/models/types/chat.types';

export type ChatSocketConnection = {
  readonly messages$: Observable<ChatWsIncoming>;
  sendUserMessage(text: string): void;
  sendTyping(isTyping: boolean): void;
  close(): void;
};

function buildChatWebSocketUrl(chatApiHttpBase: string, chatId: number, token: string): string {
  const u = new URL(chatApiHttpBase);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = `/ws/chat/${chatId}/`;
  u.search = '';
  u.hash = '';
  u.searchParams.set('token', token);
  return u.toString();
}

@Injectable({ providedIn: 'root' })
export class ChatWebSocketService {
  open(chatId: number, token: string | null): ChatSocketConnection | null {
    const base = environment.chatApiUrl?.trim();
    if (!base || !token) {
      return null;
    }

    const inbound = new Subject<ChatWsIncoming>();
    const ws = new WebSocket(buildChatWebSocketUrl(base, chatId, token));

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        inbound.next(JSON.parse(event.data) as ChatWsIncoming);
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      inbound.next({ type: 'error', detail: 'WebSocket transport error' });
    };

    ws.onclose = () => {
      inbound.complete();
    };

    return {
      messages$: inbound.asObservable(),
      sendUserMessage(text: string): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat.message', message: text }));
        }
      },
      sendTyping(isTyping: boolean): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat.typing', is_typing: isTyping }));
        }
      },
      close(): void {
        ws.close();
        inbound.complete();
      },
    };
  }
}
