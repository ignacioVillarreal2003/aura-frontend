import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logout-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logout-confirmation-modal.component.html',
  styleUrls: ['./logout-confirmation-modal.component.css']
})
export class LogoutConfirmationModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onConfirm() {
    this.confirm.emit();
    this.onClose();
  }

  onCancel() {
    this.onClose();
  }
}
