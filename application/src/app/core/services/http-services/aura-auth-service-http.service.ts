import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AuthLoginBody,
  AuthLogoutBody,
  AuthLogoutResponseDto,
  AuthRefreshBody,
  AuthTokenPairDto,
  AuthValidateUserDto,
  ChangePasswordBody,
  UserLookupResponseDto,
} from '@aura-types/aura-auth-service.types';

@Injectable({ providedIn: 'root' })
export class AuraAuthServiceHttp {
  private readonly http = inject(HttpClient);
  private readonly base = environment.authenticationApiUrl.replace(/\/$/, '');

  login(body: AuthLoginBody): Observable<AuthTokenPairDto> {
    return this.http.post<AuthTokenPairDto>(`${this.base}/auth/login`, body);
  }

  refresh(body: AuthRefreshBody): Observable<AuthTokenPairDto> {
    return this.http.post<AuthTokenPairDto>(`${this.base}/auth/refresh`, body);
  }

  logout(body: AuthLogoutBody): Observable<AuthLogoutResponseDto> {
    return this.http.post<AuthLogoutResponseDto>(`${this.base}/auth/logout`, body);
  }

  changePassword(body: ChangePasswordBody): Observable<AuthLogoutResponseDto> {
    return this.http.post<AuthLogoutResponseDto>(`${this.base}/auth/change-password`, body);
  }

  validate(): Observable<AuthValidateUserDto> {
    return this.http.get<AuthValidateUserDto>(`${this.base}/auth/validate`);
  }

  lookupUsers(query: string): Observable<UserLookupResponseDto> {
    return this.http.get<UserLookupResponseDto>(`${this.base}/auth/users/lookup`, {
      params: { q: query },
    });
  }

  getUsersByIds(ids: number[]): Observable<UserLookupResponseDto> {
    return this.http.get<UserLookupResponseDto>(`${this.base}/auth/users/by-ids`, {
      params: { ids: ids.join(',') },
    });
  }
}
