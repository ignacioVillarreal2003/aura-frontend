import {Component, EventEmitter, Output, input} from '@angular/core';
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
  readonly heading = input<string>('Title');
  @Output() onClose: EventEmitter<void> = new EventEmitter<void>();

  close(): void {
    this.onClose.emit();
  }
}
