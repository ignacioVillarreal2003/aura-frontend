import { Injectable, signal } from '@angular/core';
import type { ChatDetail } from '@core/models/types/chat.types';

/** Metadatos del chat activo para el shell (listas y mensajes vienen del API). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly currentChat = signal<ChatDetail | null>(null);

  setCurrentChat(chat: ChatDetail | null): void {
    this.currentChat.set(chat);
  }

  getCurrentChat(): ChatDetail | null {
    return this.currentChat();
  }
}
