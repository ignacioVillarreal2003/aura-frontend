import {Injectable, inject, signal} from '@angular/core';
import {Observable, catchError, finalize, map, of, tap, throwError} from 'rxjs';
import {environment} from '../../../../environments/environment';
import type {User} from '@core/models/types/chat.types';
import {AuthenticationHttpService} from '../http/authentication-http.service';

@Injectable({providedIn: 'root'})
export class AuthenticationService {
  private readonly authHttp = inject(AuthenticationHttpService);
  private readonly accessToken = signal<string | null>(initialAccessToken());
  private readonly refreshToken = signal<string | null>(null);
  private readonly sessionActive = signal(false);
  /** Last username used at login (for sidebar display; not a substitute for a profile API). */
  private readonly sessionDisplayName = signal<string | null>(null);

  isLoggedIn(): boolean {
    return this.sessionActive();
  }

  getToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  setAccessToken(token: string | null): void {
    this.accessToken.set(token);
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken.set(token);
  }

  loginWithCredentials(username: string, password: string): Observable<void> {
    return this.authHttp.login({username, password}).pipe(
      tap((res) => {
        this.accessToken.set(res.access_token);
        this.refreshToken.set(res.refresh_token);
        this.sessionActive.set(true);
        this.sessionDisplayName.set(username.trim() || null);
      }),
      map(() => undefined)
    );
  }

  /** Display user for chat shell (name from login until a profile endpoint exists). */
  getSidebarUser(): User {
    const name = this.sessionDisplayName()?.trim() || 'Usuario';
    return {name, member_id: null};
  }

  logout(): Observable<void> {
    const refresh = this.refreshToken();
    if (!refresh) {
      this.clearLocalSession();
      return of(undefined);
    }
    return this.authHttp.logout({refresh_token: refresh}).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.clearLocalSession())
    );
  }

  refreshSession(): Observable<void> {
    const refresh = this.refreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.authHttp.refresh({refresh_token: refresh}).pipe(
      tap((res) => {
        this.accessToken.set(res.access_token);
        this.refreshToken.set(res.refresh_token);
      }),
      map(() => undefined)
    );
  }

  private clearLocalSession(): void {
    this.sessionActive.set(false);
    this.refreshToken.set(null);
    this.sessionDisplayName.set(null);
    this.accessToken.set(initialAccessToken());
  }
}

function initialAccessToken(): string | null {
  if (environment.production) {
    return null;
  }
  return 'devAccessToken' in environment && typeof environment.devAccessToken === 'string'
    ? environment.devAccessToken
    : null;
}
