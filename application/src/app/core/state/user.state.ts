import { Injectable, signal } from '@angular/core';
import type { AuthValidateUserDto } from '@core/types/aura-auth-service.types';

@Injectable({ providedIn: 'root' })
export class UserState {
  readonly user = signal<AuthValidateUserDto | null>(null);

  setUser(user: AuthValidateUserDto | null): void {
    this.user.set(user);
  }
}
