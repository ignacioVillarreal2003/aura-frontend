import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {InputText} from '../../../../shared/components/inputs/input-text/input-text';
import {BtnText} from '../../../../shared/components/buttons/btn-text/btn-text';
import {Router} from '@angular/router';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
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
  private auth = inject(AuthenticationService);

  @ViewChild('emailField', { read: ElementRef }) emailField!: ElementRef<HTMLElement>;
  @ViewChild('passField',  { read: ElementRef }) passField!:  ElementRef<HTMLElement>;

  email = '';
  password = '';

  private readValue(host: ElementRef<HTMLElement>): string {
      const input = host.nativeElement.querySelector('input') as HTMLInputElement | null;
      return input?.value ?? '';
  }

  submitting = false;
  errorMessage: string | null = null;

  onSubmit(evt: Event) {
    evt.preventDefault();
    const username = this.readValue(this.emailField);
    const password = this.readValue(this.passField);
    this.errorMessage = null;
    this.submitting = true;
    this.auth.loginWithCredentials(username, password).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigateByUrl('/main-container');
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = 'Usuario o contraseña incorrectos.';
      },
    });
  }
}
