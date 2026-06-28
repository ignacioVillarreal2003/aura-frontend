import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
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
  private readonly refreshToken = signal<string | null>(sessionStorage.getItem(SESSION_REFRESH_KEY));
  private readonly sessionActive = signal(false);
  private readonly sessionDisplayName = signal<string | null>(null);

  /**
   * Refresh en vuelo compartido. Como el backend usa refresh tokens rotativos de
   * un solo uso (reusar uno revocado cierra TODAS las sesiones), nunca puede
   * haber dos `POST /auth/refresh` en paralelo con el mismo token. Distintos
   * llamadores (interceptor HTTP, stream SSE, guard) comparten esta misma llamada.
   */
  private refreshInFlight$: Observable<void> | null = null;

  isLoggedIn(): boolean {
    return this.sessionActive();
  }

  getToken(): string | null {
    return this.accessToken();
  }

  /**
   * Devuelve un access token vigente, refrescándolo antes si está expirado o por
   * expirar. Pensado para conexiones que toman el token una sola vez y no pasan
   * por el interceptor HTTP (WebSocket): evita abrir con un token muerto cuando
   * la única actividad fue por WS durante más que la vida del access token.
   */
  ensureFreshToken(): Observable<string | null> {
    const token = this.accessToken();
    if (token && !this.isTokenExpiring(token)) {
      return of(token);
    }
    if (!this.refreshToken()) {
      return of(token);
    }
    return this.refreshSession().pipe(
      map(() => this.accessToken()),
      catchError(() => of(this.accessToken())),
    );
  }

  /** True si el token venció o vence dentro del margen (o si no se puede leer su `exp`). */
  private isTokenExpiring(token: string, skewSeconds = 30): boolean {
    const exp = this.tokenExp(token);
    if (exp == null) return true;
    return Date.now() >= exp * 1000 - skewSeconds * 1000;
  }

  private tokenExp(token: string): number | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const payload = JSON.parse(atob(b64 + pad)) as { exp?: unknown };
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
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
    // Coalescé llamadas concurrentes en una sola: si ya hay un refresh en vuelo,
    // devolvé esa misma observación en lugar de disparar otro POST /auth/refresh
    // (que reutilizaría el refresh token rotativo y cerraría todas las sesiones).
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    const refresh = this.refreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }
    this.refreshInFlight$ = this.authHttp.refresh({ refresh_token: refresh }).pipe(
      tap((res) => {
        this.persistTokenPair(res);
      }),
      map(() => undefined),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
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
