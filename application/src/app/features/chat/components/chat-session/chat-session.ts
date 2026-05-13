import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subscription,
  catchError,
  distinctUntilChanged,
  EMPTY,
  forkJoin,
  map,
  switchMap,
  tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ChatApiMessage, ChatDetail, ChatWsIncoming } from '@core/models/types/chat.types';
import { ChatService } from '@core/services/chat.service';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { ChatWebSocketService, type ChatSocketConnection } from '@core/services/chat-websocket.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import { DocumentProcessingHttpService } from '@core/services/http/document-processing-http.service';
import { normalizeMessageRow } from '@core/models/chat-mappers';
import { ChatOptionsDrawerComponent } from '../chat-options-drawer/chat-options-drawer';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';

@Component({
  selector: 'app-chat-session',
  standalone: true,
  imports: [CommonModule, FormsModule, BtnIcon, ChatOptionsDrawerComponent],
  templateUrl: './chat-session.html',
  styleUrls: ['./chat-session.css'],
})
export class ChatSessionComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatShell = inject(ChatService);
  private readonly api = inject(AuraChatApiService);
  private readonly wsFactory = inject(ChatWebSocketService);
  private readonly auth = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly documents = inject(DocumentProcessingHttpService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  private chatId: number | null = null;
  private socket: ChatSocketConnection | null = null;
  private wsMessagesSub: Subscription | undefined;

  /** Negative temp id while assistant message streams in over WebSocket. */
  readonly streamingAssistantId = signal<number | null>(null);

  chat: ChatDetail | null = null;
  messages = signal<ChatApiMessage[]>([]);
  newMessage = '';
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);
  documentUploading = signal(false);

  private deltaBuffer = '';
  private rafHandle: number | null = null;
  private pendingDeltaChatId: number | null = null;

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        map((raw) => (raw != null ? Number.parseInt(raw, 10) : Number.NaN)),
        distinctUntilChanged(),
        switchMap((id) => {
          if (!Number.isFinite(id) || id < 1) {
            void this.router.navigate(['/main-container', 'chat-home']);
            return EMPTY;
          }

          this.teardownSocket();
          this.clearDeltaScheduling();
          this.streamingAssistantId.set(null);
          this.isTyping.set(false);

          this.chatId = id;
          this.loading = true;
          this.chat = null;
          this.messages.set([]);

          const pending = this.consumePendingMessageFromHistory();

          return forkJoin({
            detail: this.api.getChat(id),
            messages: this.api.listAllMessagesChronological(id),
          }).pipe(
            catchError(() => {
              this.toast.show('No se pudo cargar el chat.', 'error');
              void this.router.navigate(['/main-container', 'chats']);
              return EMPTY;
            }),
            tap(({ detail, messages: msgs }) => {
              this.chat = detail;
              this.chatShell.setCurrentChat(detail);
              this.messages.set(msgs);
              this.loading = false;
              void this.openWebSocketAfterLoad(id, pending);
              setTimeout(() => this.scrollToBottom(), 100);
              queueMicrotask(() => this.autosizeTextarea());
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  toggleOptions(): void {
    this.optionsOpen.update((v) => !v);
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.chatId || this.documentUploading()) return;
    this.documentUploading.set(true);
    this.documents
      .createDocument({ file, chat_id: this.chatId, prefer_docling: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.show('Documento subido; se procesará en segundo plano.', 'success');
          this.documentUploading.set(false);
        },
        error: () => {
          this.toast.show('Error al subir el documento.', 'error');
          this.documentUploading.set(false);
        },
      });
  }

  onDocumentFromDrawer(file: File): void {
    if (!this.chatId || this.documentUploading()) return;
    this.documentUploading.set(true);
    this.documents
      .createDocument({ file, chat_id: this.chatId, prefer_docling: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.show('Documento subido; se procesará en segundo plano.', 'success');
          this.documentUploading.set(false);
          this.optionsOpen.set(false);
        },
        error: () => {
          this.toast.show('Error al subir el documento.', 'error');
          this.documentUploading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.teardownSocket();
    this.clearDeltaScheduling();
    this.chatShell.setCurrentChat(null);
  }

  sendBlocked(): boolean {
    return this.isTyping() || this.streamingAssistantId() !== null;
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.sendBlocked()) return;

    const text = this.newMessage.trim();
    this.newMessage = '';
    queueMicrotask(() => this.autosizeTextarea());

    if (this.socket) {
      this.socket.sendUserMessage(text);
      setTimeout(() => this.scrollToBottom(), 50);
      return;
    }

    if (!this.chatId) return;
    this.isTyping.set(true);
    this.api
      .sendMessageRest(this.chatId, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const userRow = normalizeMessageRow(res.message, this.chatId!);
          this.messages.update((m) => [...m, userRow]);
          if (res.assistant?.answer) {
            this.messages.update((m) => [
              ...m,
              {
                id: Date.now(),
                chat_id: this.chatId!,
                message: res.assistant!.answer,
                sender_type: 'system',
                created_by: null,
                created_at: new Date().toISOString(),
                deleted_at: null,
                is_bookmarked: false,
                user_feedback: null,
                thread_reply_count: 0,
              },
            ]);
          }
          if (res.assistant_error) {
            this.toast.show(res.assistant_error.detail, 'error');
          }
          this.isTyping.set(false);
          setTimeout(() => this.scrollToBottom(), 50);
        },
        error: () => {
          this.toast.show('No se pudo enviar el mensaje.', 'error');
          this.isTyping.set(false);
        },
      });
  }

  onNewMessageChange(value: string): void {
    this.newMessage = value;
    queueMicrotask(() => this.autosizeTextarea());
  }

  private autosizeTextarea(): void {
    const el = this.messageBox()?.nativeElement;
    if (!el) return;

    const styles = getComputedStyle(el);
    const maxHeight = parseFloat(styles.maxHeight);
    const maxPx = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160;

    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const next = Math.min(scrollH, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = scrollH > maxPx ? 'auto' : 'hidden';
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private consumePendingMessageFromHistory(): string | undefined {
    const navState = history.state as { pendingMessage?: string } | null;
    const pending = navState?.pendingMessage?.trim();
    if (navState && 'pendingMessage' in navState) {
      const { pendingMessage: _p, ...rest } = navState;
      history.replaceState(rest, '');
    }
    return pending?.trim() || undefined;
  }

  private async openWebSocketAfterLoad(expectedChatId: number, pending?: string): Promise<void> {
    if (this.chatId !== expectedChatId) return;
    const conn = this.wsFactory.open(expectedChatId, this.auth.getToken());
    if (!conn) {
      if (pending) {
        this.toast.show('No hay conexión en tiempo real; enviá de nuevo el mensaje.', 'error');
      }
      return;
    }
    this.socket = conn;
    this.wsMessagesSub = conn.messages$.subscribe({
      next: (msg) => this.handleWsMessage(msg),
      complete: () => this.onWebSocketMessagesComplete(),
    });

    try {
      await conn.whenOpen;
    } catch {
      if (this.chatId !== expectedChatId) {
        return;
      }
      if (pending?.trim()) {
        this.toast.show('No se pudo conectar el chat en tiempo real. Probá enviar de nuevo.', 'error');
      }
      return;
    }

    if (this.chatId !== expectedChatId) {
      conn.close();
      return;
    }

    if (pending?.trim()) {
      conn.sendUserMessage(pending.trim());
    }
  }

  private onWebSocketMessagesComplete(): void {
    this.flushPendingDeltas();
    this.streamingAssistantId.set(null);
    this.isTyping.set(false);
    this.cdr.markForCheck();
  }

  private teardownSocket(): void {
    this.wsMessagesSub?.unsubscribe();
    this.wsMessagesSub = undefined;
    this.socket?.close();
    this.socket = null;
  }

  private handleWsMessage(msg: ChatWsIncoming): void {
    const cid = this.chatId;
    if (cid == null) return;
    switch (msg.type) {
      case 'user_message': {
        const row: ChatApiMessage = {
          id: msg.id,
          chat_id: cid,
          message: msg.message,
          sender_type: msg.sender_type,
          created_by: msg.created_by,
          created_at: msg.created_at,
          deleted_at: null,
          is_bookmarked: false,
          user_feedback: null,
          thread_reply_count: 0,
        };
        this.messages.update((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
        setTimeout(() => this.scrollToBottom(), 50);
        break;
      }
      case 'ai_meta':
        this.isTyping.set(true);
        break;
      case 'ai_delta': {
        const delta = msg.delta ?? '';
        this.isTyping.set(false);
        this.scheduleDeltaApply(cid, delta);
        break;
      }
      case 'ai_complete': {
        this.flushPendingDeltas();
        const text = msg.answer || msg.message || '';
        const sid = this.streamingAssistantId();
        if (sid != null && msg.id != null) {
          this.messages.update((list) =>
            list.map((m) =>
              m.id === sid
                ? {
                    id: msg.id!,
                    chat_id: cid,
                    message: text,
                    sender_type: msg.sender_type ?? 'system',
                    created_by: msg.created_by ?? null,
                    created_at: msg.created_at ?? new Date().toISOString(),
                    deleted_at: null,
                    is_bookmarked: false,
                    user_feedback: null,
                    thread_reply_count: 0,
                  }
                : m
            )
          );
        } else if (sid != null) {
          this.messages.update((list) =>
            list.map((m) => (m.id === sid ? { ...m, message: text } : m))
          );
        } else {
          this.messages.update((list) => [
            ...list,
            {
              id: msg.id ?? Date.now(),
              chat_id: cid,
              message: text,
              sender_type: msg.sender_type ?? 'system',
              created_by: msg.created_by ?? null,
              created_at: msg.created_at ?? new Date().toISOString(),
              deleted_at: null,
              is_bookmarked: false,
              user_feedback: null,
              thread_reply_count: 0,
            },
          ]);
        }
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        setTimeout(() => this.scrollToBottom(), 50);
        this.cdr.markForCheck();
        break;
      }
      case 'ai_error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.toast.show(msg.detail, 'error');
        this.cdr.markForCheck();
        break;
      case 'error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.toast.show(msg.detail, 'error');
        this.cdr.markForCheck();
        break;
      default:
        break;
    }
  }

  private clearDeltaScheduling(): void {
    if (this.rafHandle != null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.deltaBuffer = '';
    this.pendingDeltaChatId = null;
  }

  private flushPendingDeltas(): void {
    if (this.rafHandle != null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    const buf = this.deltaBuffer;
    this.deltaBuffer = '';
    const cid = this.pendingDeltaChatId ?? this.chatId;
    if (!buf || cid == null) {
      this.pendingDeltaChatId = null;
      return;
    }
    this.ngZone.run(() => {
      this.applyDeltaChunk(cid, buf);
      this.cdr.markForCheck();
    });
    this.pendingDeltaChatId = null;
  }

  private scheduleDeltaApply(chatId: number, delta: string): void {
    this.pendingDeltaChatId = chatId;
    this.deltaBuffer += delta;
    if (this.rafHandle != null) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      const buf = this.deltaBuffer;
      this.deltaBuffer = '';
      const cid = this.pendingDeltaChatId ?? this.chatId;
      if (!buf || cid == null) return;
      this.ngZone.run(() => {
        this.applyDeltaChunk(cid, buf);
        this.cdr.markForCheck();
      });
    });
  }

  private applyDeltaChunk(cid: number, chunk: string): void {
    if (this.streamingAssistantId() == null) {
      const tempId = -Date.now();
      this.streamingAssistantId.set(tempId);
      this.messages.update((list) => [
        ...list,
        {
          id: tempId,
          chat_id: cid,
          message: chunk,
          sender_type: 'system',
          created_by: null,
          created_at: new Date().toISOString(),
          deleted_at: null,
          is_bookmarked: false,
          user_feedback: null,
          thread_reply_count: 0,
        },
      ]);
    } else {
      const sid = this.streamingAssistantId()!;
      this.messages.update((list) =>
        list.map((m) => (m.id === sid ? { ...m, message: m.message + chunk } : m))
      );
    }
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
