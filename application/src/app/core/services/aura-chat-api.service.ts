import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ChatHttpService } from './http/chat-http.service';
import type { ChatApiMessage, ChatDetail } from '@core/models/types/chat.types';

export type BackendChat = ChatDetail;
export type BackendMessage = ChatApiMessage;

/**
 * Facade over {@link ChatHttpService} for call sites that only need create + send + list.
 */
@Injectable({ providedIn: 'root' })
export class AuraChatApiService {
  private readonly chats = inject(ChatHttpService);

  createChat(name: string): Observable<ChatDetail> {
    return this.chats.createChat({ name });
  }

  sendMessage(chatId: number, message: string): Observable<ChatApiMessage> {
    return this.chats.createMessage(chatId, { message, sender_type: 'user' });
  }

  listMessages(chatId: number, limit = 100): Observable<{ data: ChatApiMessage[] }> {
    return this.chats
      .listMessages(chatId, { limit, include_deleted: false })
      .pipe(map((res) => ({ data: res.data })));
  }
}
