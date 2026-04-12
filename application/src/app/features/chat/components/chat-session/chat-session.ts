import { Component, OnInit, signal, inject, OnDestroy, DestroyRef, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
export class ChatSessionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatShell = inject(ChatService);
  private readonly api = inject(AuraChatApiService);
  private readonly wsFactory = inject(ChatWebSocketService);
  private readonly auth = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly documents = inject(DocumentProcessingHttpService);
  private readonly destroyRef = inject(DestroyRef);

  private chatId: number | null = null;
  private socket: ChatSocketConnection | null = null;
  private streamingAssistantId: number | null = null;

  chat: ChatDetail | null = null;
  messages = signal<ChatApiMessage[]>([]);
  newMessage = '';
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);
  documentUploading = signal(false);

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

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

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw != null ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(id) || id < 1) {
      void this.router.navigate(['/main-container', 'chat-home']);
      return;
    }
    this.chatId = id;

    const navState = history.state as { pendingMessage?: string } | null;
    const pending = navState?.pendingMessage?.trim();
    if (navState && 'pendingMessage' in navState) {
      const { pendingMessage: _p, ...rest } = navState;
      history.replaceState(rest, '');
    }

    forkJoin({
      detail: this.api.getChat(id),
      messages: this.api.listAllMessagesChronological(id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ detail, messages: msgs }) => {
          this.chat = detail;
          this.chatShell.setCurrentChat(detail);
          this.messages.set(msgs);
          this.loading = false;
          setTimeout(() => this.scrollToBottom(), 100);
          queueMicrotask(() => this.autosizeTextarea());
          this.openWebSocketIfPossible();
          if (pending?.trim()) {
            setTimeout(() => this.flushPendingMessage(pending.trim()), 250);
          }
        },
        error: () => {
          this.toast.show('No se pudo cargar el chat.', 'error');
          void this.router.navigate(['/main-container', 'chats']);
        },
      });
  }

  ngOnDestroy(): void {
    this.socket?.close();
    this.socket = null;
    this.chatShell.setCurrentChat(null);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.isTyping()) return;

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

  private openWebSocketIfPossible(): void {
    if (!this.chatId) return;
    const conn = this.wsFactory.open(this.chatId, this.auth.getToken());
    if (!conn) return;
    this.socket = conn;
    conn.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (msg) => this.handleWsMessage(msg),
    });
  }

  private flushPendingMessage(text: string): void {
    if (!text || !this.socket) return;
    this.socket.sendUserMessage(text);
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
        if (this.streamingAssistantId == null) {
          const tempId = -Date.now();
          this.streamingAssistantId = tempId;
          this.messages.update((list) => [
            ...list,
            {
              id: tempId,
              chat_id: cid,
              message: delta,
              sender_type: 'system',
              created_by: null,
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ]);
        } else {
          const sid = this.streamingAssistantId;
          this.messages.update((list) =>
            list.map((m) => (m.id === sid ? { ...m, message: m.message + delta } : m))
          );
        }
        setTimeout(() => this.scrollToBottom(), 30);
        break;
      }
      case 'ai_complete': {
        const text = msg.answer || msg.message || '';
        const sid = this.streamingAssistantId;
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
            },
          ]);
        }
        this.streamingAssistantId = null;
        this.isTyping.set(false);
        setTimeout(() => this.scrollToBottom(), 50);
        break;
      }
      case 'ai_error':
        this.streamingAssistantId = null;
        this.isTyping.set(false);
        this.toast.show(msg.detail, 'error');
        break;
      case 'error':
        this.toast.show(msg.detail, 'error');
        break;
      default:
        break;
    }
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
