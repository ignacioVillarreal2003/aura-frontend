import {Component, input, output} from '@angular/core';
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
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
