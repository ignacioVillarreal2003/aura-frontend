import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { ChatService, Chat, ChatMessage } from '../../../../core/services/chat.service';
import { AuraChatApiService } from '../../../../core/services/aura-chat-api.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private api = inject(AuraChatApiService);

  chat: Chat | null = null;
  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  loading = true;
  isTyping = signal(false);

  ngOnInit(): void {
    const chatId = this.route.snapshot.paramMap.get('id');

    if (!chatId) {
      this.router.navigate(['/main-container/new-chat']);
      return;
    }

    const foundChat = this.chatService.getChatById(chatId);

    if (!foundChat) {
      this.router.navigate(['/main-container/new-chat']);
      return;
    }

    this.chat = foundChat;
    this.chatService.setCurrentChat(this.chat);
    this.messages.set(this.chat.messages);
    this.loading = false;

    setTimeout(() => this.scrollToBottom(), 100);
  }

  ngOnDestroy(): void {
    this.chatService.setCurrentChat(null);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.isTyping()) return;

    const userMessage = this.chatService.addMessage(this.chat.id, this.newMessage, 'user');
    if (userMessage) {
      this.messages.update(msgs => [...msgs, userMessage]);
    }

    const userInput = this.newMessage;
    this.newMessage = '';
    this.isTyping.set(true);
    setTimeout(() => this.scrollToBottom(), 100);

    this.getOrCreateBackendChat().subscribe({
      next: (backendChatId) => {
        if (!this.chat) return;
        this.api.sendMessage(backendChatId, userInput).subscribe({
          next: (response) => {
            if (!this.chat) return;
            const assistantMessage = this.chatService.addMessage(
              this.chat.id,
              response.message,
              'assistant'
            );
            if (assistantMessage) {
              this.messages.update(msgs => [...msgs, assistantMessage]);
            }
            this.isTyping.set(false);
            setTimeout(() => this.scrollToBottom(), 100);
          },
          error: (err) => {
            console.error('Error calling LLM service:', err);
            this.isTyping.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error creating backend chat:', err);
        this.isTyping.set(false);
      }
    });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Returns the backend chat ID, creating the chat on the backend if needed.
   * The backend ID is cached in chat.backendChatId after the first call.
   */
  private getOrCreateBackendChat(): Observable<number> {
    if (this.chat?.backendChatId) {
      return of(this.chat.backendChatId);
    }
    const title = this.chat!.title;
    const localId = this.chat!.id;
    return this.api.createChat(title).pipe(
      tap(backendChat => {
        this.chatService.setBackendChatId(localId, backendChat.id);
        if (this.chat) {
          this.chat = { ...this.chat, backendChatId: backendChat.id };
        }
      }),
      map(backendChat => backendChat.id)
    );
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
