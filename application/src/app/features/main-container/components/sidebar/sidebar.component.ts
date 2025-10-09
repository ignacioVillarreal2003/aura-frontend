import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';

type ChatRow = { id: string; title: string; route: string };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon],
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

  chatMode: 'individual' | 'grupal' = 'individual';

  chats: ChatRow[] = [
    { id: '101', title: 'Consulta sobre epidemotitis aguda de tercer grado', route: '/chat/101' },
    { id: '102', title: 'AURA – tesis', route: '/chat/102' },
    { id: '103', title: 'Ithaka flow', route: '/chat/103' },
    { id: '104', title: 'Notas BCP', route: '/chat/104' },
  ];

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
}
