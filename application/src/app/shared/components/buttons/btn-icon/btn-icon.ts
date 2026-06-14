import {Component, input} from '@angular/core';
import {NgClass} from '@angular/common';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-btn-icon',
  imports: [
    NgClass,
    MatIcon
  ],
  templateUrl: './btn-icon.html',
  styleUrl: './btn-icon.css'
})
export class BtnIcon {
  readonly size = input<'small' | 'medium' | 'large'>('large');
  readonly variant = input<'transparent' | 'auto' | 'dark' | 'light' | 'danger'>('auto');
  readonly rounded = input<'radius-normal' | 'radius-circle'>('radius-normal');
  readonly icon = input<string>();
}
