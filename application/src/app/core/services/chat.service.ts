import { Injectable, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { AuraChatApiService } from './aura-chat-api.service';

export interface ChatMessage {
  id: number;
  chatId: number;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Chat {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(AuraChatApiService);
  private chats = signal<Chat[]>([]);
  private currentChat = signal<Chat | null>(null);

  constructor() {
    this.loadChats();
  }

  private loadChats(): void {
    this.api.listChats().subscribe({
      next: (response) => {
        const chats: Chat[] = response.data.map(c => ({
          id: c.id,
          title: c.name,
          createdAt: new Date(c.created_at),
          updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(c.created_at),
          messages: []
        }));
        this.chats.set(chats);
      },
      error: (err) => console.error('Error cargando chats:', err)
    });
  }

  getChatsSignal() {
    return this.chats.asReadonly();
  }

  getAllChats(): Chat[] {
    return this.chats();
  }

  getChatById(id: number): Chat | null {
    return this.chats().find(c => c.id === id) ?? null;
  }

  /** Inserta un chat en el estado local si aún no existe (usado al navegar directamente a /chat/:id). */
  addChatToState(chat: Chat): void {
    if (!this.getChatById(chat.id)) {
      this.chats.update(chats => [chat, ...chats]);
    }
  }

  createChat(name: string): Observable<Chat> {
    return this.api.createChat(name).pipe(
      map(bc => ({
        id: bc.id,
        title: bc.name,
        createdAt: new Date(bc.created_at),
        updatedAt: bc.updated_at ? new Date(bc.updated_at) : new Date(bc.created_at),
        messages: []
      })),
      tap(chat => this.chats.update(chats => [chat, ...chats]))
    );
  }

  deleteChat(id: number): Observable<void> {
    return this.api.deleteChat(id).pipe(
      tap(() => {
        this.chats.update(chats => chats.filter(c => c.id !== id));
        if (this.currentChat()?.id === id) {
          this.currentChat.set(null);
        }
      })
    );
  }

  updateChatTitle(id: number, name: string): Observable<void> {
    return this.api.updateChat(id, name).pipe(
      tap(() => {
        this.chats.update(chats =>
          chats.map(c => c.id === id ? { ...c, title: name, updatedAt: new Date() } : c)
        );
      }),
      map(() => undefined)
    );
  }

  setMessages(chatId: number, messages: ChatMessage[]): void {
    this.chats.update(chats =>
      chats.map(c => c.id === chatId ? { ...c, messages } : c)
    );
  }

  addMessage(chatId: number, message: ChatMessage): void {
    this.chats.update(chats =>
      chats.map(c => c.id === chatId
        ? { ...c, messages: [...c.messages, message], updatedAt: new Date() }
        : c
      )
    );
  }

  setCurrentChat(chat: Chat | null): void {
    this.currentChat.set(chat);
  }

  getCurrentChat(): Chat | null {
    return this.currentChat();
  }
}
