import {Component, Input} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-btn-text',
  imports: [
    MatIcon,
    NgClass
  ],
  templateUrl: './btn-text.html',
  styleUrl: './btn-text.css'
})
export class BtnText {
  @Input() text: string | undefined;
  @Input() style: 'normal' | 'outline' = 'normal';
  @Input() color: 'blue' | 'red' = 'blue';
  @Input() type: 'button' | 'submit' = 'button'
  @Input() disabled: boolean = false;
}
