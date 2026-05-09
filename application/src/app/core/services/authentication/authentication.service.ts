import {Injectable, inject, signal} from '@angular/core';
import {Observable, catchError, finalize, map, of, switchMap, tap, throwError} from 'rxjs';
import {environment} from '../../../../environments/environment';
import type {User} from '@core/models/types/chat.types';
import {AuthenticationHttpService} from '../http/authentication-http.service';
import {UserState} from '@core/state/user.state';

const SESSION_TOKEN_KEY = 'aura-access-token';
const SESSION_REFRESH_KEY = 'aura-refresh-token';

@Injectable({providedIn: 'root'})
export class AuthenticationService {
  private readonly authHttp = inject(AuthenticationHttpService);
  private readonly userState = inject(UserState);
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
        sessionStorage.setItem(SESSION_TOKEN_KEY, res.access_token);
        sessionStorage.setItem(SESSION_REFRESH_KEY, res.refresh_token);
      }),
      switchMap(() => this.authHttp.validate()),
      tap((user) => this.userState.setUser(user)),
      map(() => undefined)
    );
  }

  /** Display user for chat shell (name from login until a profile endpoint exists). */
  getSidebarUser(): User {
    const name = this.sessionDisplayName()?.trim() || 'Usuario';
    return {name, member_id: null};
  tryRestoreSession(): Observable<boolean> {
    const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const storedRefresh = sessionStorage.getItem(SESSION_REFRESH_KEY);
    if (!storedToken) return of(false);

    this.accessToken.set(storedToken);
    if (storedRefresh) this.refreshToken.set(storedRefresh);

    return this.authHttp.validate().pipe(
      tap((user) => {
        this.userState.setUser(user);
        this.sessionActive.set(true);
      }),
      map(() => true),
      catchError(() => {
        this.clearLocalSession();
        return of(false);
      })
    );
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
    this.userState.setUser(null);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_REFRESH_KEY);
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
