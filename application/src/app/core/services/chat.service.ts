import { Injectable, signal } from '@angular/core';
import type { ChatDetail } from '@core/models/types/chat.types';

/** Metadatos del chat activo para el shell (listas y mensajes vienen del API). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly currentChat = signal<ChatDetail | null>(null);

  /** Nombre del usuario en sesión (p. ej. desde el sidebar) para iniciales en mensajes. */
  readonly sessionViewerDisplayName = signal('');
  /** Si el backend expone el `member_id` del usuario actual, alinearlo con `message.created_by`. */
  readonly sessionViewerMemberId = signal<number | null>(null);

  setCurrentChat(chat: ChatDetail | null): void {
    this.currentChat.set(chat);
  }

  getCurrentChat(): ChatDetail | null {
    return this.currentChat();
  }

  setSessionIdentity(displayName: string, memberId: number | null = null): void {
    this.sessionViewerDisplayName.set(displayName?.trim() ?? '');
    this.sessionViewerMemberId.set(memberId);
  }
}
