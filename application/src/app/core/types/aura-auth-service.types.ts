export interface AuthLoginBody {
  readonly username: string;
  readonly password: string;
}

export interface AuthRefreshBody {
  readonly refresh_token: string;
}

export interface AuthLogoutBody {
  readonly refresh_token: string;
}

export interface AuthTokenPairDto {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
}

export interface AuthLogoutResponseDto {
  readonly detail: string;
}

export interface ChangePasswordBody {
  readonly current_password: string;
  readonly new_password: string;
}

export interface AuthValidateUserDto {
  readonly id: number;
  readonly email: string;
  readonly username: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface AuthErrorDetailDto {
  readonly detail: string;
}

export interface UserLookupDto {
  readonly id: number;
  readonly username: string;
  readonly name: string;
  readonly email: string;
}

export interface UserLookupResponseDto {
  readonly count: number;
  readonly results: readonly UserLookupDto[];
}
