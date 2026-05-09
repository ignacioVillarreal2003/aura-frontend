import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AuraChatWsClientMessage,
  AuraChatWsServerMessage,
} from '@types/aura-chat-service.types';
import { AURA_CHAT_WS_MESSAGE_MAX_CHAR } from '@types/aura-chat-service.types';
import { ToastService } from '@core/components/toast-service';

const MAX_OUTBOUND_QUEUE = 50;

export type ChatSocketConnection = {
  readonly messages$: Observable<AuraChatWsServerMessage>;
  sendUserMessage(text: string): void;
  sendTyping(isTyping: boolean): void;
  close(): void;
  readonly whenOpen: Promise<void>;
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
  private readonly toast = inject(ToastService);

  open(chatId: number, token: string | null): ChatSocketConnection | null {
    const base = environment.chatApiUrl?.trim();
    if (!base || !token) {
      return null;
    }

    const toast = this.toast;
    const inbound = new Subject<AuraChatWsServerMessage>();
    const outboundQueue: string[] = [];
    let openResolve: (() => void) | null = null;
    let openReject: ((err: Error) => void) | null = null;
    const whenOpen = new Promise<void>((resolve, reject) => {
      openResolve = resolve;
      openReject = reject;
    });

    const ws = new WebSocket(buildChatWebSocketUrl(base, chatId, token));

    const flushOutbound = (): void => {
      while (ws.readyState === WebSocket.OPEN && outboundQueue.length > 0) {
        const next = outboundQueue.shift();
        if (next != null) {
          const payload: AuraChatWsClientMessage = { type: 'chat.message', message: next };
          ws.send(JSON.stringify(payload));
        }
      }
    };

    const enqueueUserMessage = (raw: string): void => {
      const text = raw.trim();
      if (!text) return;
      if (text.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
        toast.show('El mensaje es demasiado largo.', 'error');
        return;
      }
      if (outboundQueue.length >= MAX_OUTBOUND_QUEUE) {
        toast.show('Demasiados mensajes en cola. Esperá un momento.', 'error');
        return;
      }
      outboundQueue.push(text);
      flushOutbound();
    };

    ws.onopen = () => {
      openResolve?.();
      openResolve = null;
      openReject = null;
      flushOutbound();
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        inbound.next(JSON.parse(event.data) as AuraChatWsServerMessage);
      } catch {
        /* ignore malformed payload */
      }
    };

    ws.onerror = () => {
      const errPayload: AuraChatWsServerMessage = {
        type: 'error',
        detail: 'WebSocket transport error',
      };
      inbound.next(errPayload);
      if (openReject) {
        openReject(new Error('WebSocket error before open'));
        openReject = null;
        openResolve = null;
      }
    };

    ws.onclose = () => {
      outboundQueue.length = 0;
      if (openReject) {
        openReject(new Error('WebSocket closed before open'));
        openReject = null;
        openResolve = null;
      }
      inbound.complete();
    };

    return {
      messages$: inbound.asObservable(),
      whenOpen,
      sendUserMessage(text: string): void {
        if (ws.readyState === WebSocket.OPEN) {
          const t = text.trim();
          if (!t) return;
          if (t.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
            toast.show('El mensaje es demasiado largo.', 'error');
            return;
          }
          const payload: AuraChatWsClientMessage = { type: 'chat.message', message: t };
          ws.send(JSON.stringify(payload));
          return;
        }
        if (ws.readyState === WebSocket.CONNECTING) {
          enqueueUserMessage(text);
          return;
        }
        toast.show('Conexión no disponible. Recargá la página.', 'error');
      },
      sendTyping(isTyping: boolean): void {
        if (ws.readyState === WebSocket.OPEN) {
          const payload: AuraChatWsClientMessage = {
            type: 'chat.typing',
            is_typing: isTyping,
          };
          ws.send(JSON.stringify(payload));
        }
      },
      close(): void {
        outboundQueue.length = 0;
        ws.close();
        inbound.complete();
      },
    };
  }
}
