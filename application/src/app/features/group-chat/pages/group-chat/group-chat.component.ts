import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupChatService, GroupChat } from '../../../../core/services/group-chat.service';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { GroupChatLinkModalComponent } from '../../../main-container/components/group-chat-link-modal/group-chat-link-modal.component';

interface Message {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-group-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, BtnIcon, GroupChatLinkModalComponent],
  templateUrl: './group-chat.component.html',
  styleUrls: ['./group-chat.component.css']
})
export class GroupChatComponent implements OnInit {
  groupChat: GroupChat | null = null;
  messages = signal<Message[]>([]);
  newMessage = '';
  showLinkModal = false;
  shareLink = '';
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupChatService: GroupChatService
  ) {}

  ngOnInit(): void {
    const chatId = this.route.snapshot.paramMap.get('id');
    
    if (!chatId) {
      this.router.navigate(['/main-container']);
      return;
    }

    const foundChat = this.groupChatService.getGroupChatById(chatId);
    
    if (!foundChat) {
      this.router.navigate(['/main-container']);
      return;
    }
    
    this.groupChat = foundChat;

    // Establecer como chat actual
    this.groupChatService.setCurrentGroupChat(this.groupChat);
    
    // Cargar mensajes (simulado por ahora)
    this.loadMessages();
    
    this.loading = false;
  }

  loadMessages(): void {
    // Simulación de mensajes - en producción esto vendría del backend
    const simulatedMessages: Message[] = [
      {
        id: '1',
        sender: 'usuario@ejemplo.com',
        senderName: 'Usuario Ejemplo',
        content: '¡Bienvenidos al chat grupal!',
        timestamp: new Date()
      }
    ];
    this.messages.set(simulatedMessages);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.groupChat) return;

    const message: Message = {
      id: Date.now().toString(),
      sender: this.getCurrentUserEmail(),
      senderName: this.getCurrentUserName(),
      content: this.newMessage,
      timestamp: new Date()
    };

    this.messages.update(messages => [...messages, message]);
    this.newMessage = '';

    // Scroll to bottom
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  showShareModal(): void {
    if (!this.groupChat) return;
    this.shareLink = this.groupChatService.getShareLink(this.groupChat);
    this.showLinkModal = true;
  }

  closeShareModal(): void {
    this.showLinkModal = false;
  }

  getSenderInitials(senderName: string): string {
    return senderName.charAt(0).toUpperCase();
  }

  isCurrentUser(sender: string): boolean {
    return sender === this.getCurrentUserEmail();
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getCurrentUserEmail(): string {
    // TODO: Obtener del servicio de autenticación
    return 'usuario@ejemplo.com';
  }

  private getCurrentUserName(): string {
    // TODO: Obtener del servicio de autenticación
    return 'Usuario Ejemplo';
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}

