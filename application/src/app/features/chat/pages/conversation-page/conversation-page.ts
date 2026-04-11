import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import type { ChatApiMessage, ChatDetail } from '@core/models/types/chat.types';
import { ChatService } from '@core/services/chat.service';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { ChatOptionsDrawerComponent } from '../../components/chat-options-drawer/chat-options-drawer';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';

@Component({
  selector: 'app-conversation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BtnIcon, ChatOptionsDrawerComponent],
  templateUrl: './conversation-page.html',
  styleUrls: ['./conversation-page.css'],
})
export class ConversationPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private api = inject(AuraChatApiService);

  private routeKey = '';

  chat: ChatDetail | null = null;
  messages = signal<ChatApiMessage[]>([]);
  newMessage = '';
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);

  toggleOptions(): void {
    this.optionsOpen.update((v) => !v);
  }

  ngOnInit(): void {
    const chatId = this.route.snapshot.paramMap.get('id');

    if (!chatId) {
      void this.router.navigate(['/main-container/new-chat']);
      return;
    }

    this.routeKey = chatId;
    const session = this.chatService.getSessionByRouteKey(chatId);

    if (!session) {
      void this.router.navigate(['/main-container/new-chat']);
      return;
    }

    this.chat = session.detail;
    this.chatService.setCurrentSession(session);
    this.messages.set([...session.messages]);
    this.loading = false;

    setTimeout(() => this.scrollToBottom(), 100);
  }

  ngOnDestroy(): void {
    this.chatService.setCurrentSession(null);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.isTyping()) return;

    const userMessage = this.chatService.addMessage(this.routeKey, this.newMessage, 'user');
    if (userMessage) {
      this.messages.update((msgs) => [...msgs, userMessage]);
    }

    const userInput = this.newMessage;
    this.newMessage = '';
    this.isTyping.set(true);
    setTimeout(() => this.scrollToBottom(), 100);

    this.getOrCreateBackendChat().subscribe({
      next: (backendChatId) => {
        if (!this.chat) return;
        this.api.sendMessage(backendChatId, userInput).subscribe({
          next: (response: ChatApiMessage) => {
            if (!this.chat) return;
            const assistantMessage = this.chatService.addMessage(
              this.routeKey,
              response.message,
              'system'
            );
            if (assistantMessage) {
              this.messages.update((msgs) => [...msgs, assistantMessage]);
            }
            this.isTyping.set(false);
            setTimeout(() => this.scrollToBottom(), 100);
          },
          error: (err: unknown) => {
            console.error('Error calling LLM service:', err);
            this.isTyping.set(false);
          },
        });
      },
      error: (err: unknown) => {
        console.error('Error creating backend chat:', err);
        this.isTyping.set(false);
      },
    });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getOrCreateBackendChat(): Observable<number> {
    if (this.chatService.isRemoteSynced(this.routeKey) && this.chat) {
      return of(this.chat.id);
    }
    const title = this.chat!.name;
    return this.api.createChat(title).pipe(
      tap((backendChat: ChatDetail) => {
        this.chatService.mergeRemoteDetail(this.routeKey, backendChat);
        const s = this.chatService.getSessionByRouteKey(this.routeKey);
        if (s) {
          this.chat = s.detail;
        }
      }),
      map((backendChat: ChatDetail) => backendChat.id)
    );
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
