import { Injectable, computed, signal } from '@angular/core';
import type { ChatMode } from '@aura-types/aura-chat-service.types';

export interface ChatShellContext {
  readonly id: number;
  readonly name: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly activeChat = signal<ChatShellContext | null>(null);

  readonly sessionViewerDisplayName = signal('');
  readonly sessionViewerMemberId = signal<number | null>(null);
  readonly chatMode = signal<ChatMode>('question');

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
    this.sessionViewerDisplayName.set(displayName?.trim() ?? '');
    this.sessionViewerMemberId.set(memberId);
  }

  resetSessionViewer(): void {
    this.sessionViewerDisplayName.set('');
    this.sessionViewerMemberId.set(null);
  }

  setChatMode(mode: ChatMode): void {
    this.chatMode.set(mode);
  }

  readonly pendingSummaryFiles = signal<File[]>([]);

  setPendingSummaryFiles(files: File[]): void {
    this.pendingSummaryFiles.set(files);
  }

  consumePendingSummaryFiles(): File[] {
    const files = this.pendingSummaryFiles();
    this.pendingSummaryFiles.set([]);
    return files;
  }

  reset(): void {
    this.clearCurrentChat();
    this.resetSessionViewer();
  }
}
