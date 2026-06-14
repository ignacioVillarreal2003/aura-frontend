import {Component, input} from '@angular/core';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-btn-text',
  imports: [
    NgClass
  ],
  templateUrl: './btn-text.html',
  styleUrl: './btn-text.css'
})
export class BtnText {
  readonly label = input<string>();
  readonly variant = input<'solid' | 'outline' | 'ghost'>('solid');
  readonly colorScheme = input<'violet' | 'blue' | 'red' | 'auto' | 'dark' | 'light'>('violet');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly buttonType = input<'button' | 'submit'>('button');
  readonly disabled = input<boolean>(false);
}
