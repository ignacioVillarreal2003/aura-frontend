import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BackendChat {
  id: number;
  name: string;
  system_prompt: string | null;
  response_style: string | null;
  chat_type: 'individual' | 'group';
  last_message_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string | null;
}

export interface BackendChatSummary {
  id: number;
  name: string;
  chat_type: 'individual' | 'group';
  member_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BackendMessage {
  id: number;
  chat_id: number;
  message: string;
  sender_type: 'user' | 'system';
  created_by: number | null;
  created_at: string;
  deleted_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuraChatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.chatApiUrl}/api/v1`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${environment.devToken}`,
      'Content-Type': 'application/json',
    });
  }

  listChats(limit = 100): Observable<{ data: BackendChatSummary[]; pagination: { has_more: boolean; next_cursor: string | null } }> {
    return this.http.get<any>(`${this.base}/chats?limit=${limit}`, { headers: this.headers });
  }

  createChat(name: string): Observable<BackendChat> {
    return this.http.post<BackendChat>(`${this.base}/chats`, { name }, { headers: this.headers });
  }

  getChat(chatId: number): Observable<BackendChat> {
    return this.http.get<BackendChat>(`${this.base}/chats/${chatId}`, { headers: this.headers });
  }

  updateChat(chatId: number, name: string): Observable<BackendChat> {
    return this.http.patch<BackendChat>(`${this.base}/chats/${chatId}`, { name }, { headers: this.headers });
  }

  deleteChat(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/chats/${chatId}`, { headers: this.headers });
  }

  sendMessage(chatId: number, message: string): Observable<BackendMessage> {
    return this.http.post<BackendMessage>(
      `${this.base}/chats/${chatId}/messages`,
      { message, sender_type: 'user' },
      { headers: this.headers }
    );
  }

  listMessages(chatId: number, limit = 100): Observable<{ data: BackendMessage[] }> {
    return this.http.get<{ data: BackendMessage[] }>(
      `${this.base}/chats/${chatId}/messages?limit=${limit}`,
      { headers: this.headers }
    );
  }

  openWebSocket(chatId: number): WebSocket {
    const wsBase = environment.chatApiUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    return new WebSocket(`${wsBase}/api/v1/ws/chats/${chatId}?token=${environment.devToken}`);
  }
}
