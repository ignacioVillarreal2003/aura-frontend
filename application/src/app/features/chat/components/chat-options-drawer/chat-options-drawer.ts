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

  close(): void {
    this.isOpenChange.emit(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }
}
