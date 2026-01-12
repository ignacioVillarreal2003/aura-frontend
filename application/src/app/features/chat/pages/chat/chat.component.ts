import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, Chat, ChatMessage } from '../../../../core/services/chat.service';

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
    if (!this.newMessage.trim() || !this.chat) return;

    const userMessage = this.chatService.addMessage(this.chat.id, this.newMessage, 'user');
    if (userMessage) {
      this.messages.update(msgs => [...msgs, userMessage]);
    }

    const userInput = this.newMessage;
    this.newMessage = '';

    setTimeout(() => this.scrollToBottom(), 100);

    this.simulateAssistantResponse(userInput);
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

  private simulateAssistantResponse(userInput: string): void {
    this.isTyping.set(true);

    setTimeout(() => {
      if (!this.chat) return;

      const response = this.generateMockResponse(userInput);
      const assistantMessage = this.chatService.addMessage(this.chat.id, response, 'assistant');

      if (assistantMessage) {
        this.messages.update(msgs => [...msgs, assistantMessage]);
      }

      this.isTyping.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }, 1000 + Math.random() * 1500);
  }

  private generateMockResponse(input: string): string {
    const responses = [
      'Entiendo tu consulta. Déjame ayudarte con eso.',
      'Esa es una excelente pregunta. Aquí está mi respuesta...',
      'Gracias por compartir eso. Basándome en lo que mencionas, te sugiero...',
      'He analizado tu solicitud. Esto es lo que puedo decirte...',
      'Interesante punto. Permíteme elaborar una respuesta para ti.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}


