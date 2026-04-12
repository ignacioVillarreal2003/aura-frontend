import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-logout-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-logout-modal.component.html',
  styleUrls: ['./user-logout-modal.component.css'],
})
export class UserLogoutModalComponent {
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
