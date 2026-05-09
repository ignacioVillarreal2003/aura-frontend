import { Injectable, signal } from '@angular/core';
import type { ValidateResponse } from '../models/types/authentication.types';

@Injectable({ providedIn: 'root' })
export class UserState {
  readonly user = signal<ValidateResponse | null>(null);

  setUser(user: ValidateResponse | null): void {
    this.user.set(user);
  }
}
