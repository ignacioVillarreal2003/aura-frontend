import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import type { AuthValidateUserDto } from '@core/types/aura-auth-service.types';
import { AuraAuthServiceHttp } from '@core/services/http-services/aura-auth-service-http.service';
import { UserState } from '@core/state/user.state';

const SESSION_TOKEN_KEY = 'aura-access-token';
const SESSION_REFRESH_KEY = 'aura-refresh-token';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly authHttp = inject(AuraAuthServiceHttp);
  private readonly userState = inject(UserState);
  private readonly accessToken = signal<string | null>(sessionStorage.getItem(SESSION_TOKEN_KEY));
  private readonly refreshToken = signal<string | null>(null);
  private readonly sessionActive = signal(false);
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
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken.set(token);
    if (token) {
      sessionStorage.setItem(SESSION_REFRESH_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_REFRESH_KEY);
    }
  }

  getValidatedUser(): AuthValidateUserDto | null {
    return this.userState.user();
  }

  loginWithCredentials(username: string, password: string): Observable<void> {
    const trimmedUser = username.trim();
    return this.authHttp.login({ username: trimmedUser, password }).pipe(
      tap((res) => {
        this.persistTokenPair(res);
        this.sessionActive.set(true);
        this.sessionDisplayName.set(trimmedUser || null);
      }),
      switchMap(() => this.authHttp.validate()),
      tap((user) => this.applyValidatedUser(user)),
      map(() => undefined),
    );
  }

  getSidebarUser(): { readonly name: string; readonly member_id: number | null } {
    const fromApi = this.userState.user()?.username?.trim();
    const name =
      (fromApi && fromApi.length > 0 ? fromApi : null) ??
      this.sessionDisplayName()?.trim() ??
      'Usuario';
    return { name, member_id: null };
  }

  tryRestoreSession(): Observable<boolean> {
    const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const storedRefresh = sessionStorage.getItem(SESSION_REFRESH_KEY);
    if (!storedToken) return of(false);

    this.accessToken.set(storedToken);
    if (storedRefresh) this.refreshToken.set(storedRefresh);

    return this.authHttp.validate().pipe(
      tap((user) => {
        this.applyValidatedUser(user);
        this.sessionActive.set(true);
      }),
      map(() => true),
      catchError(() => {
        if (!storedRefresh) {
          this.clearLocalSession();
          return of(false);
        }
        return this.refreshSession().pipe(
          switchMap(() => this.authHttp.validate()),
          tap((user) => {
            this.applyValidatedUser(user);
            this.sessionActive.set(true);
          }),
          map(() => true),
          catchError(() => {
            this.clearLocalSession();
            return of(false);
          }),
        );
      }),
    );
  }

  logout(): Observable<void> {
    const refresh = this.refreshToken();
    if (!refresh) {
      this.clearLocalSession();
      return of(undefined);
    }
    return this.authHttp.logout({ refresh_token: refresh }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.clearLocalSession()),
    );
  }

  refreshSession(): Observable<void> {
    const refresh = this.refreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.authHttp.refresh({ refresh_token: refresh }).pipe(
      tap((res) => {
        this.persistTokenPair(res);
      }),
      map(() => undefined),
    );
  }

  private persistTokenPair(res: { readonly access_token: string; readonly refresh_token: string }): void {
    this.accessToken.set(res.access_token);
    this.refreshToken.set(res.refresh_token);
    sessionStorage.setItem(SESSION_TOKEN_KEY, res.access_token);
    sessionStorage.setItem(SESSION_REFRESH_KEY, res.refresh_token);
  }

  private applyValidatedUser(user: AuthValidateUserDto): void {
    this.userState.setUser(user);
    const u = user.username?.trim();
    if (u) {
      this.sessionDisplayName.set(u);
    }
  }

  private clearLocalSession(): void {
    this.sessionActive.set(false);
    this.refreshToken.set(null);
    this.sessionDisplayName.set(null);
    this.accessToken.set(null);
    this.userState.setUser(null);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_REFRESH_KEY);
  }
}
