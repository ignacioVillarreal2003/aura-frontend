import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserState } from '@core/state/user.state';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.css'],
})
export class UserProfile {
  private readonly userState = inject(UserState);

  readonly displayName = computed(() => this.userState.user()?.username ?? '—');
  readonly displayEmail = computed(() => this.userState.user()?.email ?? '—');
  readonly displayRoles = computed(() => this.userState.user()?.roles ?? []);
  readonly avatarInitials = computed(() => {
    // Separa por espacios y separadores de username (. _ -): "ten.lopez" → "TL".
    const parts = (this.userState.user()?.username ?? '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });
}
