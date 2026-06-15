import { Injectable, signal } from '@angular/core';
import type { AuthValidateUserDto } from '@core/types/aura-auth-service.types';

@Injectable({ providedIn: 'root' })
export class UserState {
  private readonly _user = signal<AuthValidateUserDto | null>(null);
  readonly user = this._user.asReadonly();

  setUser(user: AuthValidateUserDto | null): void {
    this._user.set(user);
  }
}
