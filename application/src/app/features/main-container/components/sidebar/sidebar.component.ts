import { Component, EventEmitter, Input, Output, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { GroupChatService } from '../../../../core/services/group-chat.service';
import { ChatService } from '../../../../core/services/chat.service';

type ChatRow = { id: string; title: string; route: string; isGroup?: boolean };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent implements OnInit {
  private groupChatService = inject(GroupChatService);
  private chatService = inject(ChatService);
  
  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() userEmailInput = 'usuario@ejemplo.com';
  @Input() userNameInput = 'Emiliano Fau';
  @Input() userRolInput = 'Operador';

  @Output() toggle = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<string>();
  @Output() newClick = new EventEmitter<void>();
  @Output() newGroupChatClick = new EventEmitter<void>();
  @Output() chatAction = new EventEmitter<{chatId: string, action: string}>();
  @Output() chatSelect = new EventEmitter<{id: string, isGroup: boolean}>();

  individualChats: ChatRow[] = [];
  groupChats: ChatRow[] = [];
  chats: ChatRow[] = [];

  hoveredChatId = signal<string | null>(null);
  showChatMenu = signal<string | null>(null);
  menuPosition = signal<{x: number, y: number}>({x: 0, y: 0});
  visibleChats = signal<string[]>([]);

  ngOnInit(): void {
    this.loadAllChats();
  }

  loadAllChats(): void {
    const userEmail = 'usuario@ejemplo.com';
    const userGroupChats = this.groupChatService.getUserGroupChats(userEmail);
    
    this.groupChats = userGroupChats.map(gc => ({
      id: gc.id,
      title: gc.title,
      route: `/main-container/group-chat/${gc.id}`,
      isGroup: true
    }));

    const userChats = this.chatService.getAllChats();
    this.individualChats = userChats.map(c => ({
      id: c.id,
      title: c.title,
      route: `/main-container/chat/${c.id}`,
      isGroup: false
    }));

    this.chats = [...this.groupChats, ...this.individualChats];
  }

  onChatClick(chat: ChatRow): void {
    this.activeId = chat.id;
    this.chatSelect.emit({ id: chat.id, isGroup: chat.isGroup ?? false });
  }

  isOpen() { return !this.collapsed; }
  onOpenClose() { this.toggle.emit(!this.collapsed); }

  onMainClick(evt: MouseEvent) {
    if (!this.isOpen()) {
      evt.preventDefault();
      this.onOpenClose();
    } else {
      this.emitSelect('main');
    }
  }

  emitSelect(id: string) { this.select.emit(id); }
  emitNewClick() { this.newClick.emit(); }
  emitNewGroupChatClick() { 
    this.newGroupChatClick.emit(); 
  }

  userInitials() {
    const n = this.userNameInput?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  userName() { return this.userNameInput; }
  userRol() { return this.userRolInput; }

  onChatMouseEnter(chatId: string) {
    if (this.isOpen()) {
      this.hoveredChatId.set(chatId);
    }
  }

  onChatMouseLeave() {
    this.hoveredChatId.set(null);
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

  shouldShowMenuAbove(chatId: string): boolean {
    return false;
  }

  onCloseChatMenu() {
    this.showChatMenu.set(null);
  }

  onChatActionSelected(data: {chatId: string, action: string}) {
    this.chatAction.emit(data);
    this.onCloseChatMenu();
  }

  getChatTitle(chatId: string): string {
    return this.chats.find(c => c.id === chatId)?.title || '';
  }
}
