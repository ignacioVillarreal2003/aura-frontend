import { Injectable, signal } from '@angular/core';
import type { ChatApiMessage, ChatDetail, MessageSenderType } from '@core/models/types/chat.types';

/** Estado de sesión en memoria: misma fila `chat` + mensajes (no es un DTO nuevo de API). */
type ChatSession = {
  /** Clave estable del segmento `:id` en la ruta `chat/:id` bajo `main-container`. */
  routeKey: string;
  detail: ChatDetail;
  messages: ChatApiMessage[];
  /** `true` tras `POST /chats` y `mergeRemoteDetail` para este `routeKey`. */
  remoteSynced?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly sessions = signal<ChatSession[]>(seedSessions());
  private readonly currentSession = signal<ChatSession | null>(null);

  getAllSessions(): ChatSession[] {
    return this.sessions();
  }

  getSessionByRouteKey(routeKey: string): ChatSession | undefined {
    return this.sessions().find((s) => s.routeKey === routeKey);
  }

  setCurrentSession(session: ChatSession | null): void {
    this.currentSession.set(session);
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession();
  }

  addMessage(
    routeKey: string,
    text: string,
    senderType: MessageSenderType
  ): ChatApiMessage | null {
    const session = this.sessions().find((s) => s.routeKey === routeKey);
    if (!session) {
      return null;
    }
    const message: ChatApiMessage = {
      id: Date.now(),
      chat_id: session.detail.id,
      message: text,
      sender_type: senderType,
      created_by: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    this.sessions.update((list) =>
      list.map((s) =>
        s.routeKey === routeKey ? { ...s, messages: [...s.messages, message] } : s
      )
    );
    return message;
  }

  /** Tras `POST /chats`, reemplaza el `ChatDetail` local por el remoto conservando mensajes. */
  mergeRemoteDetail(routeKey: string, remote: ChatDetail): void {
    this.sessions.update((list) =>
      list.map((s) =>
        s.routeKey === routeKey ? { ...s, detail: remote, remoteSynced: true } : s
      )
    );
    const cur = this.currentSession();
    if (cur?.routeKey === routeKey) {
      this.currentSession.set({ ...cur, detail: remote, remoteSynced: true });
    }
  }

  isRemoteSynced(routeKey: string): boolean {
    return this.sessions().find((s) => s.routeKey === routeKey)?.remoteSynced === true;
  }
}

function seedSessions(): ChatSession[] {
  const mk = (
    routeKey: string,
    id: number,
    name: string,
    messages: ChatApiMessage[]
  ): ChatSession => ({
    routeKey,
    detail: {
      id,
      name,
      system_prompt: null,
      response_style: null,
      chat_type: 'individual',
      last_message_at: null,
      members: [],
      created_by: 1,
      created_at: new Date().toISOString(),
      updated_at: null,
    },
    messages,
  });

  return [
    mk(
      '101',
      101,
      'Ithaka',
      [
        {
          id: 1,
          chat_id: 101,
          message: 'Hola, necesito ayuda con el flujo de Ithaka',
          sender_type: 'user',
          created_by: null,
          created_at: new Date('2025-01-08T10:00:00').toISOString(),
          deleted_at: null,
        },
        {
          id: 2,
          chat_id: 101,
          message:
            '¡Hola! Claro, estaré encantado de ayudarte con el flujo de Ithaka. ¿Qué aspecto específico necesitas resolver?',
          sender_type: 'system',
          created_by: null,
          created_at: new Date('2025-01-08T10:00:30').toISOString(),
          deleted_at: null,
        },
      ]
    ),
    mk(
      '102',
      102,
      'Proyecto BCP',
      [
        {
          id: 3,
          chat_id: 102,
          message: 'Necesito organizar las notas del proyecto BCP',
          sender_type: 'user',
          created_by: null,
          created_at: new Date('2025-01-07T14:00:00').toISOString(),
          deleted_at: null,
        },
        {
          id: 4,
          chat_id: 102,
          message:
            'Perfecto, te ayudo a organizar las notas del proyecto BCP. ¿Cuáles son los puntos principales que necesitas documentar?',
          sender_type: 'system',
          created_by: null,
          created_at: new Date('2025-01-07T14:00:30').toISOString(),
          deleted_at: null,
        },
      ]
    ),
  ];
}
