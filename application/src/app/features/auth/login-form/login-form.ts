import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {InputText} from '../../../shared/components/inputs/input-text/input-text';
import {BtnText} from '../../../shared/components/buttons/btn-text/btn-text';
import {Router} from '@angular/router';
import {AuthService} from '../../../core/services/auth.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-login-form',
  imports: [
    InputText,
    BtnText,
    FormsModule
  ],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})
export class LoginForm {
  private router = inject(Router);
  private auth = inject(AuthService);

  @ViewChild('emailField', { read: ElementRef }) emailField!: ElementRef<HTMLElement>;
  @ViewChild('passField',  { read: ElementRef }) passField!:  ElementRef<HTMLElement>;

  email = '';
  password = '';

  private readValue(host: ElementRef<HTMLElement>): string {
      const input = host.nativeElement.querySelector('input') as HTMLInputElement | null;
      return input?.value ?? '';
  }

  onSubmit(evt: Event) {
      evt.preventDefault();
      const email = this.readValue(this.emailField);
      const pass  = this.readValue(this.passField);
      this.auth.loginHardcoded(email, pass);
      this.router.navigateByUrl('/main-chat');
  }
}
