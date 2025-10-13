import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChatMenuOption {
  id: string;
  label: string;
  icon: string;
  action: 'share' | 'rename' | 'archive' | 'delete';
  danger?: boolean;
}

@Component({
  selector: 'app-chat-options-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-options-menu.component.html',
  styleUrls: ['./chat-options-menu.component.css']
})
export class ChatOptionsMenuComponent {
  @Input() chatId: string = '';
  @Input() chatTitle: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() optionSelected = new EventEmitter<{chatId: string, action: string}>();

  menuOptions: ChatMenuOption[] = [
    {
      id: 'share',
      label: 'Compartir',
      icon: 'pi pi-share-alt',
      action: 'share'
    },
    {
      id: 'rename',
      label: 'Cambiar el nombre',
      icon: 'pi pi-pencil',
      action: 'rename'
    },
    {
      id: 'archive',
      label: 'Archivar',
      icon: 'pi pi-archive',
      action: 'archive'
    },
    {
      id: 'delete',
      label: 'Eliminar',
      icon: 'pi pi-trash',
      action: 'delete',
      danger: true
    }
  ];

  onClose() {
    this.close.emit();
  }

  onOptionClick(action: string) {
    this.optionSelected.emit({chatId: this.chatId, action});
    this.onClose();
  }
}
