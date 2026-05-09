import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserState } from '@core/state/user.state';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent {
  private readonly userState = inject(UserState);

  readonly displayName = computed(() => this.userState.user()?.username ?? '—');
  readonly displayEmail = computed(() => this.userState.user()?.email ?? '—');
  readonly displayRoles = computed(() => this.userState.user()?.roles ?? []);
  readonly avatarChar = computed(() =>
    (this.userState.user()?.username?.[0] ?? '?').toUpperCase()
  );
}
