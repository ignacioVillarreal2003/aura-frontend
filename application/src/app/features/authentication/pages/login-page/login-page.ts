import { AfterViewInit, Component } from '@angular/core';
import { animate } from 'animejs';
import { Background2 } from '../../../../shared/components/backgrounds/background-2/background-2';
import { LoginForm } from '../../components/login-form/login-form';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    Background2,
    LoginForm
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css'
})
export class LoginPage implements AfterViewInit {
  ngAfterViewInit(): void {
    animate('.auth-page__title span', {
      scale: [0, 1],
      duration: 600,
      delay: (_, i) => i * 100,
      easing: 'easeOutBack',
    });
  }
}
