import {Component, Input} from '@angular/core';
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
  @Input() label: string | undefined;
  @Input() variant: 'solid' | 'outline' | 'ghost' = 'solid';
  @Input() colorScheme: 'blue' | 'red' | 'auto' | 'dark' | 'light' = 'blue';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled: boolean = false;
}
