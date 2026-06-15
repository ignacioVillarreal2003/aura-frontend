import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ChatShellContext {
  readonly id: number;
  readonly name: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly activeChat = signal<ChatShellContext | null>(null);

  private readonly _sidebarReload$ = new Subject<void>();
  readonly sidebarReload$ = this._sidebarReload$.asObservable();

  triggerSidebarReload(): void {
    this._sidebarReload$.next();
  }

  private readonly _sessionViewerDisplayName = signal('');
  readonly sessionViewerDisplayName = this._sessionViewerDisplayName.asReadonly();
  private readonly _sessionViewerMemberId = signal<number | null>(null);
  readonly sessionViewerMemberId = this._sessionViewerMemberId.asReadonly();

  readonly activeChatContext = computed(() => this.activeChat());

  setCurrentChat(chat: ChatShellContext | null): void {
    this.activeChat.set(chat);
  }

  getCurrentChat(): ChatShellContext | null {
    return this.activeChat();
  }

  getCurrentChatId(): number | null {
    const c = this.activeChat();
    return c?.id ?? null;
  }

  updateActiveChatName(name: string): void {
    const c = this.activeChat();
    if (!c) return;
    this.activeChat.set({ ...c, name: name.trim() || c.name });
  }

  clearCurrentChat(): void {
    this.activeChat.set(null);
  }

  setSessionIdentity(displayName: string, memberId: number | null = null): void {
    this._sessionViewerDisplayName.set(displayName?.trim() ?? '');
    this._sessionViewerMemberId.set(memberId);
  }

  resetSessionViewer(): void {
    this._sessionViewerDisplayName.set('');
    this._sessionViewerMemberId.set(null);
  }

  reset(): void {
    this.clearCurrentChat();
    this.resetSessionViewer();
  }
}
