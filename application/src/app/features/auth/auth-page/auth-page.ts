import {Component} from '@angular/core';
import { animate } from 'animejs';
import {Background1} from '../../../shared/components/backgrounds/background-1/background-1';
import {Background2} from '../../../shared/components/backgrounds/background-2/background-2';

@Component({
  selector: 'app-auth-page',
  imports: [
    Background1,
    Background2
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css'
})
export class AuthPage {

  ngAfterViewInit(): void {
    animate('.auth-page__title span', {
      scale: [0, 1],
      duration: 400,
      delay: (_, i) => i * 100,
      easing: 'easeOutBack',
    });
  }
}
