import { Component, EventEmitter, Input, Output, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatService } from '@core/services/chat.service';

type ChatRow = { id: string; title: string; route: string };

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon],
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
  @Output() select = new EventEmitter<string>();
  @Output() newClick = new EventEmitter<void>();
  @Output() chatAction = new EventEmitter<{ chatId: string; action: string }>();
  @Output() chatSelect = new EventEmitter<{ id: string; isGroup: boolean }>();

  chats: ChatRow[] = [];

  showChatMenu = signal<string | null>(null);
  menuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  ngOnInit(): void {
    this.loadAllChats();
  }

  loadAllChats(): void {
    const userChats = this.chatService.getAllSessions();
    this.chats = userChats.map((s) => ({
      id: s.routeKey,
      title: s.detail.name,
      route: `/main-container/chat/${s.routeKey}`,
    }));
  }

  onChatClick(chat: ChatRow): void {
    this.chatSelect.emit({ id: chat.id, isGroup: false });
  }

  isOpen() {
    return !this.collapsed;
  }
  onOpenClose() {
    this.toggle.emit(!this.collapsed);
  }

  emitSelect(id: string) {
    this.select.emit(id);
  }
  emitNewClick() {
    this.newClick.emit();
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

    if (this.showChatMenu() === chatId) {
      this.showChatMenu.set(null);
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();

      const menuHeight = 190;

      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldShowAbove = spaceBelow < menuHeight + 20;

      const x = rect.left;
      const y = shouldShowAbove ? rect.top - menuHeight : rect.bottom + 12;

      this.menuPosition.set({ x, y });
      this.showChatMenu.set(chatId);
    }
  }

  onCloseChatMenu() {
    this.showChatMenu.set(null);
  }

  onChatActionSelected(data: { chatId: string; action: string }) {
    this.chatAction.emit(data);
    this.onCloseChatMenu();
  }
}
