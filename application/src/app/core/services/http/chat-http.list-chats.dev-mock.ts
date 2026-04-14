/**
 * Mock temporal de chats (listado, detalle GET /chats/:id/, mensajes, POST mensaje).
 *
 * Para volver al API real:
 * 1) Borrá este archivo.
 * 2) En `chat-http.service.ts`, buscá `DEV-MOCK-CHATS` y eliminá imports + bloques `if (mock$)`.
 */
import { Observable, of } from 'rxjs';
import type {
  ChatApiMessage,
  ChatDetailApiRow,
  ChatListApiRow,
  CreateMessageRequest,
  DrfCursorPage,
  DrfNumberedPage,
  PaginatedChatsResponse,
  PaginatedMessagesResponse,
  SendMessageResponse,
} from '@core/models/types/chat.types';
import {
  mapChatDetailApiToDetail,
  mapDrfCursorPageToMessages,
  mapDrfNumberedPageToChats,
} from '@core/models/chat-mappers';

/** Poné `false` para desactivar todo el mock sin borrar el archivo. */
export const DEV_MOCK_LIST_MY_CHATS_ENABLED = true;

type ListChatsQueryLike = { url?: string; page?: number; page_size?: number };
type ListMessagesQueryLike = { url?: string; cursor?: string | null; page_size?: number };

function hoursAgoIso(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() - h, d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return d.toISOString();
}

function daysAgoIso(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Misma lista que el listado; ids 9001–9005. */
const MOCK_CHAT_ROWS: ChatListApiRow[] = [
  {
    id: 9001,
    name: 'Mock — Resumen de reunión',
    last_message_at: hoursAgoIso(1),
    created_by: 1,
    created_at: daysAgoIso(1),
    member_count: 1,
  },
  {
    id: 9002,
    name: 'Mock — Ideas producto',
    last_message_at: hoursAgoIso(28),
    created_by: 1,
    created_at: daysAgoIso(2),
    member_count: 2,
  },
  {
    id: 9003,
    name: 'Mock — Borrador email',
    last_message_at: daysAgoIso(3),
    created_by: 1,
    created_at: daysAgoIso(5),
    member_count: 1,
  },
  {
    id: 9004,
    name: 'Mock — Soporte técnico',
    last_message_at: daysAgoIso(6),
    created_by: 1,
    created_at: daysAgoIso(10),
    member_count: 3,
  },
  {
    id: 9005,
    name: 'Mock — Chat sin mensajes',
    last_message_at: null,
    created_by: 1,
    created_at: daysAgoIso(14, 15),
    member_count: 1,
  },
];

const MOCK_CHAT_IDS = new Set(MOCK_CHAT_ROWS.map((r) => r.id));

function isMockChatId(chatId: number): boolean {
  return DEV_MOCK_LIST_MY_CHATS_ENABLED && MOCK_CHAT_IDS.has(chatId);
}

function listRowToDetailRow(row: ChatListApiRow): ChatDetailApiRow {
  return {
    id: row.id,
    name: row.name,
    system_prompt: null,
    response_style: null,
    last_message_at: row.last_message_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_by: null,
    updated_at: null,
  };
}

function mockMessagesForChat(chatId: number): ChatApiMessage[] {
  if (chatId === 9005) return [];
  const base = daysAgoIso(0, 9);
  const userMsg = (id: number, at: string, text: string): ChatApiMessage => ({
    id,
    chat_id: chatId,
    message: text,
    sender_type: 'user',
    created_by: 1,
    created_at: at,
    deleted_at: null,
  });
  const sysMsg = (id: number, at: string, text: string): ChatApiMessage => ({
    id,
    chat_id: chatId,
    message: text,
    sender_type: 'system',
    created_by: null,
    created_at: at,
    deleted_at: null,
  });
  const markdownDemo = `## Respuesta de ejemplo (mock)

Sí, es un chat de **prueba**. Podés usar *Markdown* en los mensajes del asistente.

### Lista rápida
- Item con \`código inline\`
- [Enlace de ejemplo](https://example.com)

> Cita de bloque para resaltar contexto.

\`\`\`ts
const demo = "resaltado de sintaxis (genérico)";
\`\`\`

| Columna A | Columna B |
|-----------|-----------|
| dato 1    | dato 2    |

---

Listo para cuando el backend envíe Markdown real.`;
  return [
    userMsg(91001, base, 'Hola, ¿podés ayudarme con este tema?'),
    sysMsg(91002, hoursAgoIso(23), markdownDemo),
    userMsg(91003, hoursAgoIso(22), 'Perfecto, gracias.'),
  ];
}

function mockDrfPage(): DrfNumberedPage<ChatListApiRow> {
  return {
    count: MOCK_CHAT_ROWS.length,
    next: null,
    previous: null,
    results: MOCK_CHAT_ROWS,
  };
}

/** Si devuelve un Observable, el servicio no llama al backend. */
export function devMockListMyChats$(query: ListChatsQueryLike): Observable<PaginatedChatsResponse> | null {
  if (!DEV_MOCK_LIST_MY_CHATS_ENABLED) return null;
  if (query.url) return null;
  return of(mapDrfNumberedPageToChats(mockDrfPage()));
}

export function devMockGetChat$(chatId: number) {
  if (!isMockChatId(chatId)) return null;
  const row = MOCK_CHAT_ROWS.find((r) => r.id === chatId);
  if (!row) return null;
  return of(mapChatDetailApiToDetail(listRowToDetailRow(row)));
}

export function devMockListMessages$(
  chatId: number,
  query: ListMessagesQueryLike
): Observable<PaginatedMessagesResponse> | null {
  if (!isMockChatId(chatId)) return null;
  if (query.url) {
    return of(mapDrfCursorPageToMessages({ next: null, previous: null, results: [] }, chatId));
  }
  const page: DrfCursorPage<ChatApiMessage> = {
    next: null,
    previous: null,
    results: mockMessagesForChat(chatId),
  };
  return of(mapDrfCursorPageToMessages(page, chatId));
}

let mockMessageSeq = 92000;

export function devMockCreateMessage$(chatId: number, body: CreateMessageRequest): Observable<SendMessageResponse> | null {
  if (!isMockChatId(chatId)) return null;
  const now = new Date().toISOString();
  const userId = ++mockMessageSeq;
  const res: SendMessageResponse = {
    message: {
      id: userId,
      chat_id: chatId,
      message: body.message,
      sender_type: body.sender_type,
      created_by: 1,
      created_at: now,
      deleted_at: null,
    },
    assistant:
      body.sender_type === 'user'
        ? {
            question: body.message,
            answer:
              '**Mock:** mensaje recibido.\n\n- En producción esto vendría del modelo.\n- Acá podés ver **negrita**, *cursiva* y `código`.',
            fragments: [],
          }
        : null,
    assistant_error: null,
  };
  return of(res);
}
