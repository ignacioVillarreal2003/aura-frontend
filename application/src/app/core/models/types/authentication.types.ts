export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AuthenticationMessageResponse {
  detail: string;
}
