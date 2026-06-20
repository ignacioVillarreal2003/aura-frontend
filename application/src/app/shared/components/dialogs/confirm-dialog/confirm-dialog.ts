import { Component, HostListener, input, output } from '@angular/core';

/**
 * Modal de confirmación reutilizable. Overlay con click-fuera y Escape para
 * cancelar. Emite `confirm` / `cancel`; el host decide qué hacer.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  readonly title = input('¿Confirmar?');
  readonly message = input('');
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  readonly danger = input(false);
  readonly icon = input('pi-question-circle');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel.emit();
  }
}
