import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ChatHttpService, type ListChatsQuery, type ListMessagesQuery } from './http/chat-http.service';
import type {
  AddMembersRequest,
  ChatApiMessage,
  ChatDetail,
  ChatMembershipRow,
  CreateChatRequest,
  CreateMessageRequest,
  PaginatedChatsResponse,
  PaginatedMembershipsResponse,
  PaginatedMessagesResponse,
  PatchChatRequest,
  SendMessageResponse,
  UpdateMemberRequest,
} from '@core/models/types/chat.types';

@Injectable({ providedIn: 'root' })
export class AuraChatApiService {
  private readonly chats = inject(ChatHttpService);

  listChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    return this.chats.listChats(query);
  }

  listMyChats(query: ListChatsQuery = {}): Observable<PaginatedChatsResponse> {
    return this.chats.listMyChats(query);
  }

  createChat(body: CreateChatRequest): Observable<ChatDetail> {
    return this.chats.createChat(body);
  }

  getChat(chatId: number): Observable<ChatDetail> {
    return this.chats.getChat(chatId);
  }

  patchChat(chatId: number, body: PatchChatRequest): Observable<ChatDetail> {
    return this.chats.patchChat(chatId, body);
  }

  deleteChat(chatId: number): Observable<void> {
    return this.chats.deleteChat(chatId);
  }

  listMessages(chatId: number, query: ListMessagesQuery = {}): Observable<PaginatedMessagesResponse> {
    return this.chats.listMessages(chatId, query);
  }

  listAllMessagesChronological(chatId: number, pageSize?: number): Observable<ChatApiMessage[]> {
    return this.chats.listAllMessagesChronological(chatId, pageSize);
  }

  createMessage(chatId: number, body: CreateMessageRequest): Observable<SendMessageResponse> {
    return this.chats.createMessage(chatId, body);
  }

  getMessage(chatId: number, messageId: number): Observable<ChatApiMessage> {
    return this.chats.getMessage(chatId, messageId);
  }

  deleteMessage(chatId: number, messageId: number): Observable<void> {
    return this.chats.deleteMessage(chatId, messageId);
  }

  listMembers(chatId: number, query: ListChatsQuery = {}): Observable<PaginatedMembershipsResponse> {
    return this.chats.listMembers(chatId, query);
  }

  addMembers(chatId: number, body: AddMembersRequest): Observable<ChatMembershipRow[]> {
    return this.chats.addMembers(chatId, body);
  }

  patchMember(chatId: number, memberId: number, body: UpdateMemberRequest): Observable<ChatMembershipRow> {
    return this.chats.patchMember(chatId, memberId, body);
  }

  removeMember(chatId: number, memberId: number): Observable<void> {
    return this.chats.removeMember(chatId, memberId);
  }

  leaveChat(chatId: number): Observable<void> {
    return this.chats.leaveChat(chatId);
  }

  archiveChat(chatId: number): Observable<void> {
    return this.chats.archiveChat(chatId);
  }

  unarchiveChat(chatId: number): Observable<void> {
    return this.chats.unarchiveChat(chatId);
  }

  sendMessageRest(chatId: number, text: string): Observable<SendMessageResponse> {
    return this.chats.createMessage(chatId, { message: text, sender_type: 'user' });
  }

  listMessagesData(chatId: number, query: ListMessagesQuery = {}): Observable<{ data: ChatApiMessage[] }> {
    return this.chats.listMessages(chatId, query).pipe(map((res) => ({ data: res.data })));
  }
}
