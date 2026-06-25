import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { BtnText } from '../../../../shared/components/buttons/btn-text/btn-text';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormsModule, BtnText],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
})
export class LoginForm {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthenticationService);

  readonly username = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSubmit(evt: Event): void {
    evt.preventDefault();
    const user = this.username().trim();
    const pass = this.password();
    if (!user || !pass) {
      this.errorMessage.set('Completá usuario y contraseña.');
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    this.auth.loginWithCredentials(user, pass).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/main-container');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(err));
      },
    });
  }

  goToAdmin(): void {
    const url = environment.adminUrl;
    if (!url) {
      this.errorMessage.set('La URL de administración no está configurada.');
      return;
    }
    window.location.href = url;
  }

  private resolveErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Error de conexión. Verificá tu internet.';
      if (err.status === 400 || err.status === 401) return 'Usuario o contraseña incorrectos.';
      if (err.status === 429) return 'Demasiados intentos. Esperá un momento e intentá de nuevo.';
      return 'Error del servidor. Intentá de nuevo más tarde.';
    }
    return 'Ocurrió un error inesperado.';
  }
}
