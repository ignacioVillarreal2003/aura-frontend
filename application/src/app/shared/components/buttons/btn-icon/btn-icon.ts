import {Component, Input} from '@angular/core';
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
  @Input() size: 'small' | 'medium' | 'large' = 'large';
  @Input() style: 'transparent' | 'auto' | 'dark' | 'light' | 'danger' = 'auto';
  @Input() rounded: 'radius-normal' | 'radius-circle' = 'radius-normal';
  @Input() icon: string | undefined;
}
