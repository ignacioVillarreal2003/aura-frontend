import { Component, HostListener, input, output } from '@angular/core';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';

@Component({
  selector: 'app-chat-options-drawer',
  standalone: true,
  imports: [BtnIcon],
  templateUrl: './chat-options-drawer.html',
  styleUrl: './chat-options-drawer.css',
  host: {
    '[class.open]': 'isOpen()',
  },
})
export class ChatOptionsDrawerComponent {
  readonly isOpen = input.required<boolean>();
  readonly isOpenChange = output<boolean>();
  readonly panelTitle = input<string>('Opciones del chat');

  /** Si hay id, el cuerpo muestra acciones de lista (sidebar); si no, el placeholder de sesión. */
  readonly actionMenuChatId = input<string | null>(null);
  readonly actionMenuChatTitle = input<string>('');

  readonly menuAction = output<{ chatId: string; action: string }>();

  close(): void {
    this.isOpenChange.emit(false);
  }

  emitMenuAction(action: string): void {
    const id = this.actionMenuChatId();
    if (id) {
      this.menuAction.emit({ chatId: id, action });
    }
    this.close();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }
}
