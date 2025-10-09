import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _logged = signal<boolean>(false);

  isLoggedIn() { return this._logged(); }

  loginHardcoded(email?: string, pass?: string) {
    // TODO: reemplazar por llamada al backend
    this._logged.set(true);
  }

  logout() { this._logged.set(false); }
}
