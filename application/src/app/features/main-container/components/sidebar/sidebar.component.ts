import { Component, EventEmitter, Input, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatModeService } from '../../../../core/services/chat-mode.service';

type ChatRow = { id: string; title: string; route: string };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  private chatModeService = inject(ChatModeService);
  
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

  get chatMode() {
    return this.chatModeService.chatMode();
  }

  chats: ChatRow[] = [
    { id: '101', title: 'Consulta sobre epidemotitis aguda de tercer grado', route: '/chat/101' },
    { id: '102', title: 'AURA – tesis', route: '/chat/102' },
    { id: '103', title: 'Ithaka flow', route: '/chat/103' },
    { id: '104', title: 'Notas BCP', route: '/chat/104' },
  ];

  // Estado para el menú de opciones
  hoveredChatId = signal<string | null>(null);
  showChatMenu = signal<string | null>(null);
  menuPosition = signal<{x: number, y: number}>({x: 0, y: 0});

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
    this.chatModeService.toggleChatMode();
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
    
    // Si ya está abierto este menú, cerrarlo; si no, abrirlo
    if (this.showChatMenu() === chatId) {
      this.showChatMenu.set(null);
    } else {
      // Calcular posición del menú
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Posición: empieza donde comienza el ícono de ...
      const x = rect.left; // Empieza exactamente donde comienza el botón
      const y = rect.bottom + 12; // 12px más abajo
      
      this.menuPosition.set({ x, y });
      this.showChatMenu.set(chatId);
    }
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
