import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, Chat, ChatMessage } from '../../../../core/services/chat.service';
import { AuraChatApiService } from '../../../../core/services/aura-chat-api.service';
import { ToastService } from '../../../../core/services/components/toast-service';

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
  private toast = inject(ToastService);

  chat: Chat | null = null;
  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  loading = signal(true);
  isTyping = signal(false);

  private ws: WebSocket | null = null;
  private pendingMessage: string | null = null;
  private routeSub?: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const chatIdStr = params.get('id');
      const chatId = chatIdStr ? parseInt(chatIdStr, 10) : NaN;

      if (isNaN(chatId)) {
        this.router.navigate(['/main-container/new-chat']);
        return;
      }

      // Cleanup del chat anterior al cambiar de parámetro
      this.ws?.close();
      this.ws = null;
      this.messages.set([]);
      this.loading.set(true);
      this.isTyping.set(false);
      this.pendingMessage = null;
      this.chat = null;

      const cached = this.chatService.getChatById(chatId);
      if (cached) {
        this.chat = cached;
        this.initChat(chatId);
      } else {
        this.api.getChat(chatId).subscribe({
          next: (bc) => {
            const chat: Chat = {
              id: bc.id,
              title: bc.name,
              createdAt: new Date(bc.created_at),
              updatedAt: bc.updated_at ? new Date(bc.updated_at) : new Date(bc.created_at),
              messages: []
            };
            this.chatService.addChatToState(chat);
            this.chat = chat;
            this.initChat(chatId);
          },
          error: () => this.router.navigate(['/main-container/new-chat'])
        });
      }
    });
  }

  private initChat(chatId: number): void {
    this.chatService.setCurrentChat(this.chat);
    this.connectWebSocket(chatId);

    const initialMessage: string | undefined = (window.history.state as any)?.['initialMessage'];
    if (initialMessage) {
      // Chat recién creado: no hay mensajes que cargar, enviar mensaje al abrir WS
      this.pendingMessage = initialMessage;
      this.loading.set(false);
    } else {
      this.api.listMessages(chatId).subscribe({
        next: (response) => {
          const msgs: ChatMessage[] = response.data.map(m => ({
            id: m.id,
            chatId: m.chat_id,
            sender: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.message,
            timestamp: new Date(m.created_at)
          }));
          this.messages.set(msgs);
          this.chatService.setMessages(chatId, msgs);
          this.loading.set(false);
          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: () => {
          this.messages.set(this.chat?.messages ?? []);
          this.loading.set(false);
        }
      });
    }
  }

  private connectWebSocket(chatId: number): void {
    this.ws = this.api.openWebSocket(chatId);

    this.ws.onopen = () => {
      if (this.pendingMessage) {
        this.sendMessageText(this.pendingMessage);
        this.pendingMessage = null;
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; data?: any; code?: string; message?: string };
      if (data.type === 'message' && data.data) {
        const msg: ChatMessage = {
          id: data.data.id,
          chatId: data.data.chat_id,
          sender: data.data.sender_type === 'user' ? 'user' : 'assistant',
          content: data.data.message,
          timestamp: new Date(data.data.created_at)
        };
        this.messages.update(msgs => [...msgs, msg]);
        if (this.chat) this.chatService.addMessage(this.chat.id, msg);
        this.isTyping.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      } else if (data.type === 'error') {
        console.error('WS error:', data.code, data.message);
        this.isTyping.set(false);
        this.toast.show(
          data.code === 'LLM_ERROR'
            ? 'El asistente no pudo responder. Intentá de nuevo.'
            : 'Error al procesar el mensaje.',
          'error'
        );
      }
    };

    this.ws.onerror = () => {
      this.isTyping.set(false);
      this.toast.show('Se perdió la conexión con el servidor.', 'error');
    };

    this.ws.onclose = (event) => {
      if (event.code !== 1000) {
        this.isTyping.set(false);
      }
    };
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.ws?.close();
    this.chatService.setCurrentChat(null);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.isTyping()) return;
    const text = this.newMessage.trim();
    this.newMessage = '';
    this.sendMessageText(text);
  }

  private sendMessageText(text: string): void {
    if (!this.chat || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      chatId: this.chat.id,
      sender: 'user',
      content: text,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.chatService.addMessage(this.chat.id, userMsg);
    this.isTyping.set(true);
    setTimeout(() => this.scrollToBottom(), 100);

    this.ws.send(JSON.stringify({ message: text }));
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.messages-container');
    if (el) el.scrollTop = el.scrollHeight;
  }
}
