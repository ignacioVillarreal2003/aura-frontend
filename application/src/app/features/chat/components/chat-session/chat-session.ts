import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  distinctUntilChanged,
  expand,
  forkJoin,
  map,
  reduce,
  switchMap,
  tap,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  AuraChatWsServerMessage,
  ChatDetailDto,
  ChatFragment,
  ChecklistMode,
  CursorPageResult,
  FeedbackValue,
  MessageDto,
  MessageSenderType,
  PinnedMessageDto,
  ReportMode,
  ReportType,
  ThreadReplyDto,
} from '@aura-types/aura-chat-service.types';
import { ChatService } from '@core/services/chat/chat.service';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ChatWebSocketService, type ChatSocketConnection } from '@core/services/websocket/chat-websocket.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import { ChatOptionsDrawer, type DocumentItem } from '../chat-options-drawer/chat-options-drawer';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { UserState } from '@core/state/user.state';

interface ChatMessage {
  readonly id: number;
  readonly chat_id: number;
  message: string;
  readonly sender_type: MessageSenderType;
  readonly created_by: number | null;
  readonly created_at: string;
  readonly is_bookmarked: boolean;
  readonly user_feedback: FeedbackValue | null;
  readonly thread_reply_count: number;
  readonly fragments?: readonly ChatFragment[] | null;
}

const REPORT_TYPES: readonly { value: ReportType; label: string; placeholder: string }[] = [
  { value: 'SITREP', label: 'SITREP — Situación', placeholder: 'Describí la situación, unidades involucradas, área de operaciones…' },
  { value: 'INTSUM', label: 'INTSUM — Inteligencia', placeholder: 'Describí la amenaza, período cubierto, eventos relevantes…' },
  { value: 'OPORD', label: 'OPORD — Operaciones', placeholder: 'Describí la misión, situación, plan de ejecución…' },
];

@Component({
  selector: 'app-chat-session',
  standalone: true,
  imports: [CommonModule, FormsModule, BtnIcon, ChatOptionsDrawer, MarkdownPipe],
  templateUrl: './chat-session.html',
  styleUrls: ['./chat-session.css'],
})
export class ChatSessionComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatShell = inject(ChatService);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly documents = inject(AuraDocumentProcessingServiceHttp);
  private readonly wsFactory = inject(ChatWebSocketService);
  private readonly auth = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userState = inject(UserState);

  readonly canUseTools = computed(() => {
    const perms = this.userState.user()?.permissions ?? [];
    return perms.includes('LLM_REPORT_GENERATE') || perms.includes('LLM_CHECKLIST_GENERATE');
  });

  readonly canReport = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_REPORT_GENERATE'));
  readonly canChecklist = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_CHECKLIST_GENERATE'));

  private chatId: number | null = null;
  private socket: ChatSocketConnection | null = null;
  private wsMessagesSub: Subscription | undefined;
  private typingOutTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly peerTypingTimers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly streamingAssistantId = signal<number | null>(null);
  readonly pinnedMessageIds = signal<Set<number>>(new Set());
  readonly processingMessageIds = signal<Set<number>>(new Set());
  readonly peerTypingIds = signal<Set<number>>(new Set());
  readonly activeThreadMessageId = signal<number | null>(null);
  readonly threadReplies = signal<ThreadReplyDto[]>([]);
  readonly threadLoading = signal(false);
  readonly threadReplyText = signal('');
  readonly submittingReply = signal(false);
  readonly exportingMessageId = signal<number | null>(null);
  readonly regenerating = signal(false);
  readonly canRegenerate = computed(() => {
    const msgs = this.messages();
    if (msgs.length === 0) return false;
    const last = msgs[msgs.length - 1];
    return (
      last.sender_type === 'system' &&
      !this.isTyping() &&
      this.streamingAssistantId() === null &&
      !this.regenerating()
    );
  });

  readonly aiProgressStep = signal<string | null>(null);
  readonly messageFragments = signal<Map<number, readonly ChatFragment[]>>(new Map());
  readonly expandedFragmentIds = signal<Set<number>>(new Set());

  chat: ChatDetailDto | null = null;
  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);
  readonly composerMode = signal<'chat' | 'report' | 'checklist'>('chat');
  readonly genReportType = signal<ReportType>('SITREP');
  readonly genMode = signal<'direct' | 'rag'>('direct');
  readonly genMessage = signal('');
  readonly genLoading = signal(false);
  readonly modeDropdownOpen = signal(false);

  readonly reportTypes = REPORT_TYPES;

  readonly composerModeLabel = computed(() => {
    switch (this.composerMode()) {
      case 'report':    return { icon: 'pi-file-edit',    label: 'Informe' };
      case 'checklist': return { icon: 'pi-check-square', label: 'Checklist' };
      default:          return { icon: 'pi-comments',     label: 'Chat' };
    }
  });

  readonly genTextareaPlaceholder = computed(() => {
    if (this.composerMode() === 'checklist') return 'Describí el procedimiento o SOP a convertir en checklist…';
    return REPORT_TYPES.find((t) => t.value === this.genReportType())?.placeholder ?? 'Ingresá el contenido…';
  });

  readonly canGenerate = computed(() => this.genMessage().trim().length > 0 && !this.genLoading());

  documentUploading = signal(false);
  readonly docDropOverlayVisible = signal(false);
  readonly sessionDocuments = signal<DocumentItem[]>([]);

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
          this.docDropOverlayVisible.set(false);
          this.sessionDocuments.set([]);
          this.composerMode.set('chat');
          this.genMessage.set('');
          this.modeDropdownOpen.set(false);
          this.loading = true;
          this.chat = null;
          this.messages.set([]);

          const pending = this.consumePendingMessageFromHistory();

          return forkJoin({
            detail: this.http.getChat(id),
            messages: this.loadAllMessagesChronological(id),
            pinned: this.http.listPinnedMessages(id, { page_size: 100 }),
          }).pipe(
            catchError(() => {
              this.toast.show('No se pudo cargar el chat.', 'error');
              void this.router.navigate(['/main-container', 'chats']);
              return EMPTY;
            }),
            tap(({ detail, messages: msgs, pinned }) => {
              this.chat = detail;
              this.chatShell.setCurrentChat(detail);
              this.messages.set(msgs);
              this._loadFragmentsFromMessages(msgs);
              this.pinnedMessageIds.set(new Set(pinned.results.map((p: PinnedMessageDto) => p.message_id)));
              this.loading = false;
              this.http.markChatAsRead(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
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

  private loadAllMessagesChronological(chatId: number): Observable<ChatMessage[]> {
    return this.http.listMessages(chatId).pipe(
      expand((page: CursorPageResult<MessageDto>) =>
        page.next ? this.http.listMessages(chatId, { url: page.next }) : EMPTY
      ),
      map((page: CursorPageResult<MessageDto>) => page.results as unknown as ChatMessage[]),
      reduce<ChatMessage[], ChatMessage[]>((acc, curr) => [...acc, ...curr], []),
      map((msgs) =>
        [...msgs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      ),
    );
  }

  toggleOptions(): void {
    this.optionsOpen.update((v) => !v);
  }

  toggleModeDropdown(): void {
    this.modeDropdownOpen.update((v) => !v);
  }

  setComposerMode(mode: 'chat' | 'report' | 'checklist'): void {
    this.composerMode.set(mode);
    this.genMessage.set('');
    this.genMode.set('direct');
    this.modeDropdownOpen.set(false);
    if (mode === 'chat') {
      setTimeout(() => this.messageBox()?.nativeElement.focus(), 50);
    }
  }

  onGenTypeChange(value: string): void {
    this.genReportType.set(value as ReportType);
  }

  generateTool(): void {
    const message = this.genMessage().trim();
    if (!message) return;

    const chatId = this.chatId ?? undefined;
    const mode = this.genMode();

    this.genLoading.set(true);

    if (this.composerMode() === 'checklist') {
      this.http
        .generateChecklist({ mode: mode as ChecklistMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.genLoading.set(false);
            this.genMessage.set('');
            this.composerMode.set('chat');
            this.toast.show('Checklist generada. Disponible en Opciones del chat → Checklists.', 'success');
          },
          error: () => {
            this.genLoading.set(false);
            this.toast.show('No se pudo generar la checklist.', 'error');
          },
        });
      return;
    }

    this.http
      .generateReport({ type: this.genReportType(), mode: mode as ReportMode, message, chat_id: chatId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.genLoading.set(false);
          this.genMessage.set('');
          this.composerMode.set('chat');
          this.toast.show('Informe generado. Disponible en Opciones del chat → Informes.', 'success');
        },
        error: () => {
          this.genLoading.set(false);
          this.toast.show('No se pudo generar el informe.', 'error');
        },
      });
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.uploadDocumentFromFile(file ?? null, false);
  }

  onDocumentFromDrawer(file: File): void {
    this.uploadDocumentFromFile(file, true);
  }

  private uploadDocumentFromFile(file: File | null, closeDrawerOnSuccess: boolean): void {
    if (!file || !this.chatId || this.documentUploading()) return;
    this.documentUploading.set(true);
    let upload$;
    try {
      upload$ = this.documents.createDocumentFromInput({
        file,
        chat_id: this.chatId,
        prefer_docling: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Archivo inválido.';
      this.toast.show(msg, 'error');
      this.documentUploading.set(false);
      return;
    }
    upload$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sessionDocuments.update((d) => [
          ...d,
          {
            id: res.id,
            name: res.name,
            status: res.status,
            created_at: new Date().toISOString(),
          },
        ]);
        this.toast.show('Documento subido; se procesará en segundo plano.', 'success');
        this.documentUploading.set(false);
        if (closeDrawerOnSuccess) {
          this.optionsOpen.set(false);
        }
      },
      error: () => {
        this.toast.show('Error al subir el documento.', 'error');
        this.documentUploading.set(false);
      },
    });
  }

  private hasFileDrag(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) return false;
    if (dataTransfer.types.includes('Files')) return true;
    return Array.from(dataTransfer.items ?? []).some((i) => i.kind === 'file');
  }

  onChatDragEnter(event: DragEvent): void {
    if (!this.chat || !this.chatId || this.documentUploading()) return;
    if (!this.hasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    this.docDropOverlayVisible.set(true);
  }

  onChatDragLeave(event: DragEvent): void {
    const root = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    this.docDropOverlayVisible.set(false);
  }

  onChatDragOver(event: DragEvent): void {
    if (!this.hasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  onChatFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.docDropOverlayVisible.set(false);
    const file = event.dataTransfer?.files?.[0];
    this.uploadDocumentFromFile(file ?? null, false);
  }

  onDocDropOverlayLeave(event: DragEvent): void {
    const el = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next && el.contains(next)) return;
    this.docDropOverlayVisible.set(false);
  }

  onDrawerChatAction(e: { chatId: number; action: string }): void {
    if (e.action === 'delete') {
      if (!window.confirm('¿Eliminar esta conversación?')) return;
      this.http.deleteChat(e.chatId).subscribe({
        next: () => {
          this.toast.show('Chat eliminado.', 'success');
          this.optionsOpen.set(false);
          void this.router.navigate(['/main-container', 'chat-home']);
        },
        error: () => this.toast.show('No se pudo eliminar el chat.', 'error'),
      });
      return;
    }
    if (e.action === 'leave' || e.action === 'archive') {
      void this.router.navigate(['/main-container', 'chat-home']);
      return;
    }
    if (e.action === 'clear-history') {
      this.messages.set([]);
      return;
    }
    if (e.action === 'lock' && this.chat) {
      this.chat = { ...this.chat, is_locked: true };
      return;
    }
    if (e.action === 'unlock' && this.chat) {
      this.chat = { ...this.chat, is_locked: false };
      return;
    }
    if (e.action === 'pin') {
      if (this.chat) this.chat = { ...this.chat, is_pinned: true };
      return;
    }
    if (e.action === 'unpin') {
      if (this.chat) this.chat = { ...this.chat, is_pinned: false };
      return;
    }
  }

  onChatMetaUpdated(e: { chatId: number; name: string }): void {
    if (this.chat && this.chat.id === e.chatId) {
      this.chat = { ...this.chat, name: e.name };
      this.chatShell.updateActiveChatName(e.name);
    }
  }

  ngOnDestroy(): void {
    this.teardownSocket();
    this.clearDeltaScheduling();
    this.chatShell.clearCurrentChat();
  }

  private clearTypingTimers(): void {
    if (this.typingOutTimer != null) {
      clearTimeout(this.typingOutTimer);
      this.typingOutTimer = null;
    }
    this.peerTypingTimers.forEach((t) => clearTimeout(t));
    this.peerTypingTimers.clear();
    this.peerTypingIds.set(new Set());
  }

  sendBlocked(): boolean {
    return this.isTyping() || this.streamingAssistantId() !== null;
  }

  regenerateResponse(): void {
    if (!this.chatId || !this.canRegenerate()) return;
    this.regenerating.set(true);
    this.http
      .regenerateAssistantResponse(this.chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const text = res.assistant?.answer ?? '';
          if (text) {
            this.messages.update((msgs) => {
              const lastSystemIdx = [...msgs].reverse().findIndex((m) => m.sender_type === 'system');
              if (lastSystemIdx === -1) return msgs;
              const realIdx = msgs.length - 1 - lastSystemIdx;
              return msgs.map((m, i) =>
                i === realIdx ? { ...m, message: text, created_at: new Date().toISOString() } : m
              );
            });
          }
          if (res.assistant_error) {
            this.toast.show(res.assistant_error.detail, 'error');
          }
          this.regenerating.set(false);
          setTimeout(() => this.scrollToBottom(), 50);
        },
        error: () => {
          this.toast.show('No se pudo regenerar la respuesta.', 'error');
          this.regenerating.set(false);
        },
      });
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
    this.http
      .sendMessageJson(this.chatId, { message: text })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const userRow: ChatMessage = { ...res.message, created_by: res.message.created_by };
          this.messages.update((m) => [...m, userRow]);
          if (res.assistant?.answer) {
            this.messages.update((m) => [
              ...m,
              {
                id: Date.now(),
                chat_id: this.chatId!,
                message: res.assistant!.answer,
                sender_type: 'system' as MessageSenderType,
                created_by: null,
                created_at: new Date().toISOString(),
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
    this.emitTypingStart();
  }

  private emitTypingStart(): void {
    if (!this.socket) return;
    this.socket.sendTyping(true);
    if (this.typingOutTimer != null) clearTimeout(this.typingOutTimer);
    this.typingOutTimer = setTimeout(() => {
      this.socket?.sendTyping(false);
      this.typingOutTimer = null;
    }, 2000);
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

  isProcessing(msgId: number): boolean {
    return this.processingMessageIds().has(msgId);
  }

  isPinned(msgId: number): boolean {
    return this.pinnedMessageIds().has(msgId);
  }

  private setProcessing(id: number, active: boolean): void {
    this.processingMessageIds.update((s) => {
      const next = new Set(s);
      active ? next.add(id) : next.delete(id);
      return next;
    });
  }

  deleteMessage(message: ChatMessage): void {
    if (!this.chatId || !window.confirm('¿Eliminar este mensaje?')) return;
    this.setProcessing(message.id, true);
    this.http.deleteMessage(this.chatId, message.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update((msgs) => msgs.filter((m) => m.id !== message.id));
          this.setProcessing(message.id, false);
        },
        error: () => {
          this.toast.show('No se pudo eliminar el mensaje.', 'error');
          this.setProcessing(message.id, false);
        },
      });
  }

  toggleBookmark(message: ChatMessage): void {
    if (!this.chatId) return;
    this.setProcessing(message.id, true);
    const obs$ = message.is_bookmarked
      ? this.http.unbookmarkMessage(this.chatId, message.id)
      : this.http.bookmarkMessage(this.chatId, message.id);
    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messages.update((msgs) =>
          msgs.map((m) => (m.id === message.id ? { ...m, is_bookmarked: !m.is_bookmarked } : m))
        );
        this.setProcessing(message.id, false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar el guardado.', 'error');
        this.setProcessing(message.id, false);
      },
    });
  }

  togglePinMessage(message: ChatMessage): void {
    if (!this.chatId) return;
    const pinned = this.isPinned(message.id);
    this.setProcessing(message.id, true);
    const obs$ = pinned
      ? this.http.unpinMessage(this.chatId, message.id)
      : this.http.pinMessage(this.chatId, message.id);
    (obs$ as Observable<unknown>).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pinnedMessageIds.update((s) => {
          const next = new Set(s);
          pinned ? next.delete(message.id) : next.add(message.id);
          return next;
        });
        this.setProcessing(message.id, false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar el mensaje fijado.', 'error');
        this.setProcessing(message.id, false);
      },
    });
  }

  toggleThread(message: ChatMessage): void {
    if (this.activeThreadMessageId() === message.id) {
      this.activeThreadMessageId.set(null);
      this.threadReplies.set([]);
      this.threadReplyText.set('');
      return;
    }
    this.activeThreadMessageId.set(message.id);
    this.threadReplies.set([]);
    this.threadReplyText.set('');
    this.loadThreadReplies(message.id);
  }

  private loadThreadReplies(messageId: number): void {
    if (!this.chatId) return;
    this.threadLoading.set(true);
    this.http
      .listThreadReplies(this.chatId, messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (replies) => {
          this.threadReplies.set([...replies]);
          this.threadLoading.set(false);
        },
        error: () => {
          this.toast.show('No se pudieron cargar las respuestas del hilo.', 'error');
          this.threadLoading.set(false);
        },
      });
  }

  submitThreadReply(messageId: number): void {
    if (!this.chatId || !this.threadReplyText().trim() || this.submittingReply()) return;
    const text = this.threadReplyText().trim();
    this.submittingReply.set(true);
    this.http
      .addThreadReply(this.chatId, messageId, { message: text })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reply) => {
          this.threadReplies.update((r) => [...r, reply]);
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === messageId ? { ...m, thread_reply_count: m.thread_reply_count + 1 } : m
            )
          );
          this.threadReplyText.set('');
          this.submittingReply.set(false);
        },
        error: () => {
          this.toast.show('No se pudo enviar la respuesta.', 'error');
          this.submittingReply.set(false);
        },
      });
  }

  onThreadReplyKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const activeId = this.activeThreadMessageId();
      if (activeId != null) this.submitThreadReply(activeId);
    }
  }

  toggleFeedback(message: ChatMessage, value: FeedbackValue): void {
    if (!this.chatId) return;
    this.setProcessing(message.id, true);
    const isToggleOff = message.user_feedback === value;
    const onSuccess = () => {
      this.messages.update((msgs) =>
        msgs.map((m) =>
          m.id === message.id ? { ...m, user_feedback: isToggleOff ? null : value } : m
        )
      );
      this.setProcessing(message.id, false);
    };
    const onError = () => {
      this.toast.show('No se pudo registrar el feedback.', 'error');
      this.setProcessing(message.id, false);
    };
    if (isToggleOff) {
      this.http
        .deleteMessageFeedback(this.chatId, message.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: onSuccess, error: onError });
    } else {
      this.http
        .setMessageFeedback(this.chatId, message.id, { value })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: onSuccess, error: onError });
    }
  }

  exportMessageAsPdf(message: ChatMessage): void {
    if (!this.chatId || this.exportingMessageId() !== null) return;
    this.exportingMessageId.set(message.id);
    this.http
      .exportMessagePdf(this.chatId, message.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mensaje-${message.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.exportingMessageId.set(null);
        },
        error: () => {
          this.toast.show('No se pudo exportar el mensaje.', 'error');
          this.exportingMessageId.set(null);
        },
      });
  }

  userBubbleInitials(message: ChatMessage): string {
    const sessionName = this.chatShell.sessionViewerDisplayName();
    const sessionMemberId = this.chatShell.sessionViewerMemberId();
    if (message.created_by != null && sessionMemberId != null && message.created_by === sessionMemberId) {
      return this.initialsFromDisplayName(sessionName);
    }
    if (sessionName && this.chat && message.created_by != null && message.created_by === this.chat.created_by) {
      return this.initialsFromDisplayName(sessionName);
    }
    return this.initialsFromUserId(message.created_by);
  }

  userBubbleTitle(message: ChatMessage): string {
    const sessionName = this.chatShell.sessionViewerDisplayName();
    const sessionMemberId = this.chatShell.sessionViewerMemberId();
    if (message.created_by != null && sessionMemberId != null && message.created_by === sessionMemberId) {
      return sessionName ? `${sessionName} · vos` : `Usuario · id ${message.created_by}`;
    }
    if (sessionName && this.chat && message.created_by != null && message.created_by === this.chat.created_by) {
      return `${sessionName} · creador del chat`;
    }
    return message.created_by != null ? `Participante · id ${message.created_by}` : 'Usuario';
  }

  private initialsFromDisplayName(raw: string): string {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private initialsFromUserId(id: number | null): string {
    if (id == null) return '?';
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const a = alphabet[id % alphabet.length];
    const b = alphabet[(id * 17) % alphabet.length];
    return `${a}${b}`;
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  progressLabel(step: string | null): string {
    const labels: Record<string, string> = {
      question_processing: 'Procesando pregunta…',
      context_retrieval: 'Buscando contexto relevante…',
      answer_generation: 'Generando respuesta…',
    };
    return step ? (labels[step] ?? step) : '';
  }

  hasFragments(id: number): boolean {
    return (this.messageFragments().get(id)?.length ?? 0) > 0;
  }

  getFragments(id: number): readonly ChatFragment[] {
    return this.messageFragments().get(id) ?? [];
  }

  isFragmentsExpanded(id: number): boolean {
    return this.expandedFragmentIds().has(id);
  }

  toggleFragments(id: number): void {
    this.expandedFragmentIds.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  private _loadFragmentsFromMessages(msgs: readonly ChatMessage[]): void {
    const entries = msgs
      .filter((m) => m.fragments?.length)
      .map((m) => [m.id, m.fragments as readonly ChatFragment[]] as const);
    if (entries.length === 0) return;
    this.messageFragments.update((map) => {
      const n = new Map(map);
      for (const [id, frags] of entries) n.set(id, frags);
      return n;
    });
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
    this.clearTypingTimers();
  }

  private handleWsMessage(msg: AuraChatWsServerMessage): void {
    const cid = this.chatId;
    if (cid == null) return;
    switch (msg.type) {
      case 'user_message': {
        const row: ChatMessage = {
          id: msg.id,
          chat_id: cid,
          message: msg.message,
          sender_type: msg.sender_type,
          created_by: msg.created_by,
          created_at: msg.created_at,
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
      case 'ai_progress':
        this.aiProgressStep.set(msg.step);
        this.cdr.markForCheck();
        break;
      case 'ai_delta': {
        const delta = msg.delta ?? '';
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
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
                    sender_type: (msg.sender_type ?? 'system') as MessageSenderType,
                    created_by: msg.created_by ?? null,
                    created_at: msg.created_at ?? new Date().toISOString(),
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
              sender_type: (msg.sender_type ?? 'system') as MessageSenderType,
              created_by: msg.created_by ?? null,
              created_at: msg.created_at ?? new Date().toISOString(),
              is_bookmarked: false,
              user_feedback: null,
              thread_reply_count: 0,
            },
          ]);
        }
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        if (msg.fragments?.length) {
          const fragId = msg.id ?? sid ?? Date.now();
          this.messageFragments.update((m) => {
            const n = new Map(m);
            n.set(fragId as number, msg.fragments);
            return n;
          });
        }
        setTimeout(() => this.scrollToBottom(), 50);
        this.cdr.markForCheck();
        break;
      }
      case 'ai_error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.toast.show(msg.detail, 'error');
        this.cdr.markForCheck();
        break;
      case 'error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.toast.show(msg.detail, 'error');
        this.cdr.markForCheck();
        break;
      case 'typing': {
        const uid = msg.user_id;
        if (msg.is_typing) {
          this.peerTypingIds.update((s) => { const n = new Set(s); n.add(uid); return n; });
          const prev = this.peerTypingTimers.get(uid);
          if (prev != null) clearTimeout(prev);
          this.peerTypingTimers.set(uid, setTimeout(() => {
            this.peerTypingIds.update((s) => { const n = new Set(s); n.delete(uid); return n; });
            this.peerTypingTimers.delete(uid);
          }, 4000));
        } else {
          this.peerTypingIds.update((s) => { const n = new Set(s); n.delete(uid); return n; });
          const t = this.peerTypingTimers.get(uid);
          if (t != null) { clearTimeout(t); this.peerTypingTimers.delete(uid); }
        }
        this.cdr.markForCheck();
        break;
      }
      case 'chat_locked_changed':
        if (this.chat) {
          this.chat = { ...this.chat, is_locked: msg.is_locked };
          this.cdr.markForCheck();
        }
        break;
      case 'member_joined':
        this.toast.show(`Participante ${msg.member_id} se unió al chat.`, 'success');
        break;
      case 'member_left':
        this.toast.show(`Participante ${msg.member_id} abandonó el chat.`, 'success');
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
          sender_type: 'system' as MessageSenderType,
          created_by: null,
          created_at: new Date().toISOString(),
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
