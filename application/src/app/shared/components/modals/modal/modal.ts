import {Component, EventEmitter, Input, Output} from '@angular/core';
import {BtnIcon} from '../../buttons/btn-icon/btn-icon';

@Component({
  selector: 'app-modal',
  imports: [
    BtnIcon
  ],
  templateUrl: './modal.html',
  styleUrl: './modal.css'
})
export class Modal {
  @Input() title: string = 'Title';
  @Output() onClose: EventEmitter<void> = new EventEmitter<void>();

  close(): void {
    this.onClose.emit();
  }
}
