import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { USER_AREA_NAV_LINKS } from '@core/config/user-area.nav';
import { UserLogoutModal } from '../components/user-logout-modal/user-logout-modal';
import { AuthenticationService } from '@core/services/authentication/authentication.service';

@Component({
  selector: 'app-user-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    UserLogoutModal,
  ],
  templateUrl: './user-page.html',
  styleUrls: ['./user-page.css'],
})
export class UserPage {
  private router = inject(Router);
  private authService = inject(AuthenticationService);

  readonly areaNavLinks = USER_AREA_NAV_LINKS;

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
