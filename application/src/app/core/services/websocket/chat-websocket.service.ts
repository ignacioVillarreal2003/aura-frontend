import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AuraChatAiMode,
  AuraChatWsClientMessage,
  AuraChatWsServerMessage,
} from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_WS_MESSAGE_MAX_CHAR } from '@aura-types/aura-chat-service.types';
import { ToastService } from '@core/components/toast-service';

const MAX_OUTBOUND_QUEUE = 50;

/** Generation-context options for an outbound chat message. */
export interface ChatSendOptions {
  readonly documentIds?: readonly number[];
  readonly retrieveContext?: boolean | null;
  readonly processDocuments?: boolean | null;
}

interface OutboundMessage {
  readonly kind: 'message' | 'regenerate';
  readonly text?: string;
  readonly mode?: AuraChatAiMode;
  readonly options?: ChatSendOptions;
}

export type ChatSocketConnection = {
  readonly messages$: Observable<AuraChatWsServerMessage>;
  sendUserMessage(text: string, mode?: AuraChatAiMode, options?: ChatSendOptions): void;
  sendRegenerate(mode?: AuraChatAiMode): void;
  sendTyping(isTyping: boolean): void;
  /** Peer chat (human-to-human, no AI) — shares the same socket/group. */
  sendPeerMessage(text: string): void;
  editPeerMessage(id: number, text: string): void;
  deletePeerMessage(id: number): void;
  sendPeerTyping(isTyping: boolean): void;
  close(): void;
  readonly whenOpen: Promise<void>;
};

function buildChatMessagePayload(text: string, mode?: AuraChatAiMode, options?: ChatSendOptions): AuraChatWsClientMessage {
  const payload: {
    type: 'chat.message';
    message: string;
    mode?: AuraChatAiMode;
    document_ids?: readonly number[];
    retrieve_context?: boolean | null;
    process_documents?: boolean | null;
  } = { type: 'chat.message', message: text };
  if (mode) payload.mode = mode;
  if (options?.documentIds && options.documentIds.length > 0) payload.document_ids = options.documentIds;
  if (options?.retrieveContext != null) payload.retrieve_context = options.retrieveContext;
  if (options?.processDocuments != null) payload.process_documents = options.processDocuments;
  return payload as AuraChatWsClientMessage;
}

function buildRegeneratePayload(mode?: AuraChatAiMode): AuraChatWsClientMessage {
  return mode ? { type: 'chat.regenerate', mode } : { type: 'chat.regenerate' };
}

function buildOutboundPayload(msg: OutboundMessage): AuraChatWsClientMessage {
  return msg.kind === 'regenerate'
    ? buildRegeneratePayload(msg.mode)
    : buildChatMessagePayload(msg.text ?? '', msg.mode, msg.options);
}

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
    const outboundQueue: OutboundMessage[] = [];
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
          ws.send(JSON.stringify(buildOutboundPayload(next)));
        }
      }
    };

    const enqueueOutbound = (msg: OutboundMessage): void => {
      if (outboundQueue.length >= MAX_OUTBOUND_QUEUE) {
        toast.show('Demasiados mensajes en cola. Esperá un momento.', 'error');
        return;
      }
      outboundQueue.push(msg);
      flushOutbound();
    };

    const enqueueUserMessage = (raw: string, mode?: AuraChatAiMode, options?: ChatSendOptions): void => {
      const text = raw.trim();
      if (!text) return;
      if (text.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
        toast.show('El mensaje es demasiado largo.', 'error');
        return;
      }
      enqueueOutbound({ kind: 'message', text, mode, options });
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
      sendUserMessage(text: string, mode?: AuraChatAiMode, options?: ChatSendOptions): void {
        if (ws.readyState === WebSocket.OPEN) {
          const t = text.trim();
          if (!t) return;
          if (t.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
            toast.show('El mensaje es demasiado largo.', 'error');
            return;
          }
          ws.send(JSON.stringify(buildChatMessagePayload(t, mode, options)));
          return;
        }
        if (ws.readyState === WebSocket.CONNECTING) {
          enqueueUserMessage(text, mode, options);
          return;
        }
        toast.show('Conexión no disponible. Recargá la página.', 'error');
      },
      sendRegenerate(mode?: AuraChatAiMode): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(buildRegeneratePayload(mode)));
          return;
        }
        if (ws.readyState === WebSocket.CONNECTING) {
          enqueueOutbound({ kind: 'regenerate', mode });
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
      sendPeerMessage(text: string): void {
        const t = text.trim();
        if (!t) return;
        if (t.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
          toast.show('El mensaje es demasiado largo.', 'error');
          return;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'peer.message', message: t } as AuraChatWsClientMessage));
          return;
        }
        toast.show('Conexión no disponible. Recargá la página.', 'error');
      },
      editPeerMessage(id: number, text: string): void {
        const t = text.trim();
        if (!t) return;
        if (t.length > AURA_CHAT_WS_MESSAGE_MAX_CHAR) {
          toast.show('El mensaje es demasiado largo.', 'error');
          return;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'peer.message.edit', id, message: t } as AuraChatWsClientMessage));
          return;
        }
        toast.show('Conexión no disponible. Recargá la página.', 'error');
      },
      deletePeerMessage(id: number): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'peer.message.delete', id } as AuraChatWsClientMessage));
        }
      },
      sendPeerTyping(isTyping: boolean): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'peer.typing', is_typing: isTyping } as AuraChatWsClientMessage));
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
