import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatOptionsMenuComponent } from '../chat-options-menu/chat-options-menu.component';

type ChatRow = { id: string; title: string; route: string };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon, ChatOptionsMenuComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() userEmailInput = 'usuario@ejemplo.com';
  @Input() userNameInput = 'Emiliano Fau';
  @Input() userRolInput = 'Operador';

  @Output() toggle = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<string>();
  @Output() newClick = new EventEmitter<void>();
  @Output() chatModeChange = new EventEmitter<string>();
  @Output() chatAction = new EventEmitter<{chatId: string, action: string}>();

  chatMode: 'individual' | 'grupal' = 'individual';

  chats: ChatRow[] = [
    { id: '101', title: 'Consulta sobre epidemotitis aguda de tercer grado', route: '/chat/101' },
    { id: '102', title: 'AURA – tesis', route: '/chat/102' },
    { id: '103', title: 'Ithaka flow', route: '/chat/103' },
    { id: '104', title: 'Notas BCP', route: '/chat/104' },
  ];

  // Estado para el menú de opciones
  hoveredChatId = signal<string | null>(null);
  showChatMenu = signal<{chatId: string, position: {x: number, y: number}} | null>(null);

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

  toggleChatMode() {
    this.chatMode = this.chatMode === 'individual' ? 'grupal' : 'individual';
    this.chatModeChange.emit(this.chatMode);
  }

  userInitials() {
    const n = this.userNameInput?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  userName() { return this.userNameInput; }
  userRol() { return this.userRolInput; }

  // Métodos para el manejo del menú de opciones
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
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // Posicionar el menú debajo del botón, alineado a la derecha
    const menuWidth = 200; // Ancho del menú según CSS
    const padding = 4; // Pequeño espacio entre el botón y el menú
    
    this.showChatMenu.set({
      chatId,
      position: { 
        x: rect.right - menuWidth, // Alineado a la derecha del botón
        y: rect.bottom + padding   // Debajo del botón
      }
    });
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
