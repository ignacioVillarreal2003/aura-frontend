import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogoutConfirmationModalComponent } from '../../components/logout-confirmation-modal/logout-confirmation-modal.component';
import { AuthenticationService } from '@core/services/authentication/authentication.service';

@Component({
  selector: 'app-user-shell-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LogoutConfirmationModalComponent,
  ],
  templateUrl: './user-shell-page.html',
  styleUrls: ['./user-shell-page.css'],
})
export class UserShellPageComponent {
  private router = inject(Router);
  private authService = inject(AuthenticationService);

  showLogoutModal = signal(false);

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  onCloseLogoutModal(): void {
    this.showLogoutModal.set(false);
  }

  onConfirmLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/login']);
        this.showLogoutModal.set(false);
      },
    });
  }
}
