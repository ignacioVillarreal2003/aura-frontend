import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AuthenticationMessageResponse,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  TokenPairResponse,
  ValidateResponse,
} from '@core/models/types/authentication.types';

@Injectable({ providedIn: 'root' })
export class AuthenticationHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.authenticationApiUrl;

  login(body: LoginRequest): Observable<TokenPairResponse> {
    return this.http.post<TokenPairResponse>(`${this.base}/auth/login`, body);
  }

  logout(body: LogoutRequest): Observable<AuthenticationMessageResponse> {
    return this.http.post<AuthenticationMessageResponse>(`${this.base}/auth/logout`, body);
  }

  refresh(body: RefreshRequest): Observable<TokenPairResponse> {
    return this.http.post<TokenPairResponse>(`${this.base}/auth/refresh`, body);
  }

  validate(): Observable<ValidateResponse> {
    return this.http.get<ValidateResponse>(`${this.base}/auth/validate`);
  }
}
