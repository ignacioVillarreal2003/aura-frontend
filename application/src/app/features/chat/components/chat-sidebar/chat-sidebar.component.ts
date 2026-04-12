import { Component, EventEmitter, Input, Output, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatOptionsDrawerComponent } from '../chat-options-drawer/chat-options-drawer';
import { ChatService } from '@core/services/chat.service';

type ChatRow = { id: string; title: string };

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon, ChatOptionsDrawerComponent, RouterLink],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.css'],
})
export class ChatSidebarComponent implements OnInit {
  private chatService = inject(ChatService);

  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() userEmailInput = 'usuario@ejemplo.com';
  @Input() userNameInput = 'Emiliano Fau';
  @Input() userRolInput = 'Operador';

  @Output() toggle = new EventEmitter<boolean>();
  @Output() chatAction = new EventEmitter<{ chatId: string; action: string }>();

  chats: ChatRow[] = [];

  chatActionsDrawerOpen = signal(false);
  drawerChatId = signal<string | null>(null);
  drawerChatTitle = signal('');

  ngOnInit(): void {
    this.loadAllChats();
  }

  loadAllChats(): void {
    const userChats = this.chatService.getAllSessions();
    this.chats = userChats.map((s) => ({
      id: s.routeKey,
      title: s.detail.name,
    }));
  }

  isOpen() {
    return !this.collapsed;
  }
  onOpenClose() {
    this.toggle.emit(!this.collapsed);
  }

  userInitials() {
    const n = this.userNameInput?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  userName() {
    return this.userNameInput;
  }
  userRol() {
    return this.userRolInput;
  }

  onChatOptionsClick(event: MouseEvent, chatId: string) {
    event.stopPropagation();
    const row = this.chats.find((c) => c.id === chatId);
    if (!row) return;
    this.drawerChatId.set(chatId);
    this.drawerChatTitle.set(row.title);
    this.chatActionsDrawerOpen.set(true);
  }

  onChatActionsDrawerChange(open: boolean): void {
    this.chatActionsDrawerOpen.set(open);
    if (!open) {
      this.drawerChatId.set(null);
      this.drawerChatTitle.set('');
    }
  }

  onDrawerMenuAction(data: { chatId: string; action: string }): void {
    this.chatAction.emit(data);
  }
}
