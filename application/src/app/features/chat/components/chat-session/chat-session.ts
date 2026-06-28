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
  Subject,
  Subscription,
  catchError,
  distinctUntilChanged,
  firstValueFrom,
  forkJoin,
  map,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  ArtifactMode,
  ArtifactStatus,
  ArtifactSummaryDto,
  ArtifactType,
  AuraChatAiMode,
  AuraChatWsServerMessage,
  ChatDetailDto,
  ChatFragment,
  DocumentActionType,
  FeedbackReason,
  FeedbackValue,
  MessageSenderType,
  PageNumberResult,
  PinnedArtifactDto,
  ReportType,
  ThreadReplyDto,
} from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_AI_MODE_DEFAULT } from '@aura-types/aura-chat-service.types';
import { ChatService } from '@core/services/chat/chat.service';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ChatWebSocketService, type ChatSocketConnection } from '@core/services/websocket/chat-websocket.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import { ChatOptionsDrawer, type DocumentItem } from '../chat-options-drawer/chat-options-drawer';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { TokenMaterializeDirective } from '../../../../shared/directives/token-materialize.directive';
import { UserState } from '@core/state/user.state';
import { UserCacheService } from '@core/services/user-cache.service';
import {
  FeedbackDialog,
  type DislikeFeedbackResult,
} from '../feedback-dialog/feedback-dialog';
import {
  ChatComposer,
  type ComposerAudio,
  type ComposerChatSubmit,
  type ComposerDoc,
  type ComposerGenerate,
} from '../chat-composer/chat-composer';
import { ChatComposerHandoffService } from '../chat-composer/chat-composer-handoff.service';

interface ChatMessage {
  readonly id: number;
  readonly chat_id: number;
  message: string;
  readonly sender_type: MessageSenderType;
  readonly created_by: number | null;
  readonly created_at: string;
  is_bookmarked: boolean;
  readonly user_feedback: FeedbackValue | null;
  readonly user_feedback_reason?: FeedbackReason | null;
  readonly user_feedback_comment?: string | null;
  readonly thread_reply_count: number;
  readonly fragments?: readonly ChatFragment[] | null;
  readonly artifactType: ArtifactType;
  readonly artifactTitle?: string;
  readonly artifactDescription?: string;
  readonly artifactStatus?: ArtifactStatus;
  readonly artifactMode?: ArtifactMode;
  readonly artifactLinkedId?: number | null;
  readonly messageId?: number;
}

/** A unique source document behind an AI answer (fragments collapsed by document). */
interface SourceDocument {
  readonly id: number;
  readonly name: string;
  readonly type: string | null;
  readonly category: string | null;
  readonly matched: number;
}

@Component({
  selector: 'app-chat-session',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatOptionsDrawer, MarkdownPipe, TokenMaterializeDirective, FeedbackDialog, ChatComposer],
  templateUrl: './chat-session.html',
  styleUrls: ['./chat-session.css'],
  host: {
    '(document:click)': 'onDocumentClick()',
  },
})
export class ChatSession implements OnDestroy {
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
  private readonly userCache = inject(UserCacheService);
  private readonly handoff = inject(ChatComposerHandoffService);

  private chatId: number | null = null;
  private wsSessionId = 0;
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
  readonly threadHasMore = signal(false);
  readonly threadPage = signal(1);
  readonly threadEditingReplyId = signal<number | null>(null);
  readonly threadEditText = signal('');
  readonly updatingReply = signal(false);
  readonly deletingReplyIds = signal<Set<number>>(new Set());
  readonly currentUserId = computed(() => this.userState.user()?.id ?? null);
  readonly threadScrollBodyRef = viewChild<ElementRef<HTMLDivElement>>('threadScrollBody');
  private _threadObserver: IntersectionObserver | null = null;
  readonly feedbackDialogMessageId = signal<number | null>(null);
  readonly pendingDeleteMessage = signal<ChatMessage | null>(null);
  readonly exportingMessageId = signal<number | null>(null);
  readonly exportDropdownId = signal<number | null>(null);
  readonly copiedMessageId = signal<number | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasMoreMessages = signal(false);
  readonly loadingOlderMessages = signal(false);
  private _olderMessagesUrl: string | null = null;
  private _messagesTopObserver: IntersectionObserver | null = null;
  readonly messagesContainerRef = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  onDocumentClick(): void {
    if (this.exportDropdownId() !== null) {
      this.exportDropdownId.set(null);
    }
  }
  readonly threadLoading = signal(false);
  readonly threadReplyText = signal('');
  readonly submittingReply = signal(false);
  readonly resolvingLinkedId = signal<number | null>(null);
  readonly aiProgressStep = signal<string | null>(null);
  readonly aiProgressMessage = signal<string | null>(null);
  readonly messageFragments = signal<Map<number, readonly ChatFragment[]>>(new Map());
  readonly expandedFragmentIds = signal<Set<number>>(new Set());

  chat: ChatDetailDto | null = null;
  messages = signal<ChatMessage[]>([]);
  readonly messageUserMap = signal<Map<number, { username: string; name: string }>>(new Map());
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);
  readonly genLoading = signal(false);

  // ── AI chat mode (kept to drive the auto-sent pending message) ──
  readonly aiMode = signal<AuraChatAiMode>(AURA_CHAT_AI_MODE_DEFAULT);

  private readonly composer = viewChild(ChatComposer);

  readonly perms = computed(() => this.userState.user()?.permissions ?? []);
  readonly attachedComposerDocs = computed<ComposerDoc[]>(() =>
    this.sessionDocuments().map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status === 'processed' ? 'ready' : d.status === 'failed' ? 'failed' : 'processing',
    })),
  );
  readonly allDocsReady = computed(() => this.sessionDocuments().every((d) => d.status === 'processed'));

  documentUploading = signal(false);
  readonly docDropOverlayVisible = signal(false);
  readonly sessionDocuments = signal<DocumentItem[]>([]);

  /** Context toggles carried from the home composer for the first message (null = backend default). */
  private _pendingChatOptions: { retrieveContext: boolean | null; processDocuments: boolean | null } =
    { retrieveContext: null, processDocuments: null };

  private readonly _docPolls = new Map<number, Subject<void>>();
  /** Interval handle while waiting for home-seeded documents to finish processing. */
  private _docReadyWaitHandle: ReturnType<typeof setInterval> | null = null;
  private deltaBuffer = '';
  private rafHandle: number | null = null;
  private pendingDeltaChatId: number | null = null;

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
          const sessionId = ++this.wsSessionId;
          this.docDropOverlayVisible.set(false);
          this.sessionDocuments.set([]);
          this.aiMode.set(AURA_CHAT_AI_MODE_DEFAULT);
          this.composer()?.resetToChat();
          this.composer()?.clearText();
          this.composer()?.presetAiMode(AURA_CHAT_AI_MODE_DEFAULT);
          this.loading = true;
          this.chat = null;
          this.messages.set([]);

          const pending = this.consumePendingMessageFromHistory();
          const pendingAiMode = this.consumePendingAiModeFromHistory();
          if (pendingAiMode) {
            this.aiMode.set(pendingAiMode);
            this.composer()?.presetAiMode(pendingAiMode);
          }
          this._pendingChatOptions = this.consumePendingChatFlagsFromHistory();
          this.seedPendingDocuments();

          this._olderMessagesUrl = null;
          this.hasMoreMessages.set(false);
          this.loadingOlderMessages.set(false);
          this._messagesTopObserver?.disconnect();

          return forkJoin({
            detail: this.http.getChat(id),
            messages: this.loadInitialMessages(id),
            pinned: this.http.listPinnedArtifacts(id, { page_size: 100 }),
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
              this._resolveMessageUsers(msgs);
              this._loadFragmentsFromMessages(msgs);
              this.pinnedMessageIds.set(new Set(pinned.results.map((p: PinnedArtifactDto) => p.artifact_id)));
              this.loading = false;
              this.http.markChatAsRead(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
              void this.openWebSocketAfterLoad(id, sessionId, pending);

              // A voice recording started on the home screen: process it now
              // against this freshly created chat (transcribe + WS / generate).
              const pendingAudio = this.handoff.consumePendingAudio();
              if (pendingAudio) {
                setTimeout(() => this.onAudioCaptured(pendingAudio), 0);
              }

              setTimeout(() => {
                this.scrollToBottom();
                this._setupMessagesTopObserver();
              }, 100);
              const gen = this.consumePendingGenerationFromHistory();
              if (gen) {
                // Esperá a que los documentos sembrados terminen de procesarse
                // antes de generar, así el artefacto sí los toma en cuenta.
                this.genLoading.set(true);
                void this.waitForSeededDocsReady(sessionId).then(() => {
                  if (this.chatId !== id || this.wsSessionId !== sessionId) {
                    this.genLoading.set(false);
                    return;
                  }
                  this.generateTool({
                    mode: gen.mode,
                    retrieveContext: gen.retrieveContext,
                    processDocuments: gen.processDocuments,
                    reportType: gen.type ?? 'SITREP',
                    documentActionType: '',
                    message: gen.message,
                  });
                });
              }
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private loadInitialMessages(chatId: number): Observable<ChatMessage[]> {
    return this.http.listChatArtifacts(chatId, { page_size: 30 }).pipe(
      map((page: PageNumberResult<ArtifactSummaryDto>) => {
        this._olderMessagesUrl = page.next ?? null;
        this.hasMoreMessages.set(page.next != null);
        return [...page.results]
          .map((a) => this._artifactToMessage(a))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }),
    );
  }

  loadOlderMessages(): void {
    if (!this._olderMessagesUrl || this.loadingOlderMessages()) return;
    const url = this._olderMessagesUrl;
    this.loadingOlderMessages.set(true);

    const container = this.messagesContainerRef()?.nativeElement;
    const scrollHeightBefore = container?.scrollHeight ?? 0;

    this.http.listChatArtifacts(0, { url }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (page) => {
        this._olderMessagesUrl = page.next ?? null;
        this.hasMoreMessages.set(page.next != null);
        const older = [...page.results]
          .map((a) => this._artifactToMessage(a))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        this._resolveMessageUsers(older);
        this._loadFragmentsFromMessages(older);
        this.messages.update((curr) => [...older, ...curr]);
        this.loadingOlderMessages.set(false);
        // Restore scroll position so the viewport stays at the same message
        if (container) {
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - scrollHeightBefore;
          });
        }
      },
      error: () => {
        this.loadingOlderMessages.set(false);
      },
    });
  }

  private _setupMessagesTopObserver(): void {
    this._messagesTopObserver?.disconnect();
    const sentinel = document.getElementById('messages-top-sentinel');
    if (!sentinel) return;
    this._messagesTopObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.hasMoreMessages() && !this.loadingOlderMessages()) {
          this.loadOlderMessages();
        }
      },
      { threshold: 0.1 },
    );
    this._messagesTopObserver.observe(sentinel);
  }

  private _artifactToMessage(artifact: ArtifactSummaryDto): ChatMessage {
    if (artifact.type === 'MESSAGE' && artifact.message) {
      return {
        id: artifact.id,
        chat_id: artifact.source_chat_id,
        message: artifact.message.message,
        sender_type: artifact.message.sender_type,
        created_by: artifact.created_by,
        created_at: artifact.message.created_at,
        is_bookmarked: artifact.is_bookmarked,
        user_feedback: artifact.user_feedback,
        thread_reply_count: artifact.thread_reply_count,
        artifactType: 'MESSAGE',
        messageId: artifact.message.id,
        fragments: artifact.fragments as ChatFragment[] | null,
      };
    }
    return {
      id: artifact.id,
      chat_id: artifact.source_chat_id,
      message: artifact.description || artifact.title,
      sender_type: 'assistant' as MessageSenderType,
      created_by: artifact.created_by,
      created_at: artifact.created_at,
      is_bookmarked: artifact.is_bookmarked,
      user_feedback: artifact.user_feedback,
      thread_reply_count: artifact.thread_reply_count,
      artifactType: artifact.type,
      artifactTitle: artifact.title,
      artifactDescription: artifact.description,
      artifactStatus: artifact.status,
      artifactMode: artifact.mode,
      artifactLinkedId: artifact.linked_id ?? null,
      fragments: artifact.fragments as ChatFragment[] | null,
    };
  }

  toggleOptions(): void {
    this.optionsOpen.update((v) => !v);
  }

  // ── Composer event handlers ────────────────────────────────────
  onComposerTyping(): void {
    this.emitTypingStart();
  }

  onComposerFiles(files: File[]): void {
    files.forEach((file) => this.uploadDocumentFromFile(file, false));
  }

  onComposerRemoveDoc(doc: ComposerDoc): void {
    this.removeSessionDocument(Number(doc.id));
  }

  onComposerSubmitChat(payload: ComposerChatSubmit): void {
    this.sendChatMessage(payload.text, payload.aiMode, payload.retrieveContext, payload.processDocuments);
  }

  generateTool(payload: ComposerGenerate): void {
    const message = payload.message.trim();
    const composerMode = payload.mode;
    const chatId = this.chatId ?? undefined;
    const docIds = this.sessionDocuments().map((d) => d.id);
    // El mensaje es opcional cuando hay documentos adjuntos (generar solo desde
    // el documento). `document-summary` nunca lo exige; `document-action` sí.
    const allowEmptyMessage =
      composerMode === 'document-summary' ||
      (composerMode !== 'document-action' && docIds.length > 0);
    if (!message && !allowEmptyMessage) return;

    const ctx = {
      retrieve_context: payload.retrieveContext,
      process_documents: payload.processDocuments,
      ...(docIds.length > 0 ? { document_ids: docIds } : {}),
    };
    this.genLoading.set(true);

    const onSuccess = (
      resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string },
      type: ArtifactType,
      toastMsg: string,
      fragments?: readonly ChatFragment[] | null,
    ) => {
      this.genLoading.set(false);
      this.composer()?.resetToChat();
      this._pushGeneratedArtifact(resource, type, fragments);
      this.toast.show(toastMsg, 'success');
    };

    const onError = (toastMsg: string) => {
      this.genLoading.set(false);
      this.toast.show(toastMsg, 'error');
    };

    if (composerMode === 'checklist') {
      this.http.generateChecklist({ message, chat_id: chatId, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.checklist, 'CHECKLIST', 'Checklist generada.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar la checklist.'),
        });
      return;
    }

    if (composerMode === 'quiz') {
      this.http.generateQuiz({ message, chat_id: chatId, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.quiz, 'QUIZ', 'Quiz generado.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar el quiz.'),
        });
      return;
    }

    if (composerMode === 'timeline') {
      this.http.generateTimeline({ message, chat_id: chatId, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.timeline, 'TIMELINE', 'Línea de tiempo generada.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar la línea de tiempo.'),
        });
      return;
    }

    if (composerMode === 'lessons-learned') {
      this.http.generateLessonsLearned({ message, chat_id: chatId, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.lessons_learned, 'LESSONS_LEARNED', 'Lecciones aprendidas generadas.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar las lecciones aprendidas.'),
        });
      return;
    }

    if (composerMode === 'decision-brief') {
      this.http.generateDecisionBrief({ message, chat_id: chatId, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.decision_brief, 'DECISION_BRIEF', 'Brief de decisión generado.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar el brief de decisión.'),
        });
      return;
    }

    if (composerMode === 'document-summary') {
      if (docIds.length === 0) { onError('Subí al menos un documento antes de generar un resumen.'); return; }
      this.http.generateDocumentSummary({ document_ids: docIds, chat_id: chatId!, ...ctx })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.sessionDocuments.set([]);
            onSuccess(res.document_summary as unknown as { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string }, 'DOCUMENT_SUMMARY', 'Resumen generado.', res.fragments as unknown as ChatFragment[]);
          },
          error: () => onError('No se pudo generar el resumen.'),
        });
      return;
    }

    if (composerMode === 'document-action') {
      if (docIds.length === 0) { onError('Subí al menos un documento antes de generar la acción.'); return; }
      const actionType = payload.documentActionType;
      this.http.generateDocumentAction({
        document_ids: docIds,
        instruction: message,
        action: actionType || null,
        chat_id: chatId!,
        ...ctx,
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.sessionDocuments.set([]);
            onSuccess(res.document_action as unknown as { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string }, 'DOCUMENT_ACTION', 'Acción generada.', res.fragments as unknown as ChatFragment[]);
          },
          error: () => onError('No se pudo generar la acción.'),
        });
      return;
    }

    // report (default)
    this.http.generateReport({ type: payload.reportType, message, chat_id: chatId, ...ctx })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => onSuccess(res.report, 'REPORT', 'Informe generado.', res.fragments as unknown as ChatFragment[]),
        error: () => onError('No se pudo generar el informe.'),
      });
  }

  private _pushGeneratedArtifact(
    resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string },
    type: ArtifactType,
    fragments?: readonly ChatFragment[] | null,
  ): void {
    const tempId = -Date.now();
    this.messages.update((msgs) => [
      ...msgs,
      {
        id: tempId,
        chat_id: resource.source_chat_id ?? this.chatId ?? 0,
        message: resource.title,
        sender_type: 'assistant' as MessageSenderType,
        created_by: resource.created_by,
        created_at: resource.created_at,
        is_bookmarked: false,
        user_feedback: null,
        thread_reply_count: 0,
        artifactType: type,
        artifactTitle: resource.title,
        artifactStatus: 'draft' as ArtifactStatus,
        artifactLinkedId: resource.id,
        fragments: fragments ?? null,
      },
    ]);
    if (fragments?.length) {
      this.messageFragments.update((m) => {
        const n = new Map(m);
        n.set(tempId, fragments);
        return n;
      });
    }
    setTimeout(() => this.scrollToBottom(), 50);
  }

  removeSessionDocument(docId: number): void {
    this._stopDocumentPolling(docId);
    this.sessionDocuments.update((docs) => docs.filter((d) => d.id !== docId));
    this.documents.deleteDocument(docId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.toast.show('No se pudo eliminar el documento del servidor.', 'error'),
    });
  }

  onDocumentFromDrawer(file: File): void {
    this.uploadDocumentFromFile(file, true);
  }

  private _startDocumentPolling(docId: number): void {
    this._stopDocumentPolling(docId);
    const stop$ = new Subject<void>();
    this._docPolls.set(docId, stop$);

    timer(1500, 2500).pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(stop$),
      switchMap(() => this.documents.getDocumentStatus(docId)),
    ).subscribe({
      next: (doc) => {
        this.sessionDocuments.update(docs =>
          docs.map(d => d.id === docId ? { ...d, status: doc.status } : d),
        );
        if (doc.status === 'processed' || doc.status === 'failed') {
          this._stopDocumentPolling(docId);
          if (doc.status === 'failed') {
            this.toast.show('Error al procesar el documento.', 'error');
          }
        }
      },
      error: () => this._stopDocumentPolling(docId),
    });
  }

  private _stopDocumentPolling(docId: number): void {
    const stop$ = this._docPolls.get(docId);
    if (stop$) { stop$.next(); stop$.complete(); this._docPolls.delete(docId); }
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
        this.documentUploading.set(false);
        if (closeDrawerOnSuccess) {
          this.optionsOpen.set(false);
        }
        this._startDocumentPolling(res.id);
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

  onDrawerChatAction(e: { chatId: number; action: string; tags?: readonly string[] }): void {
    if (e.action === 'delete') {
      this.optionsOpen.set(false);
      void this.router.navigate(['/main-container', 'chat-home']);
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
    if (e.action === 'tags-updated' && this.chat && this.chat.id === e.chatId && e.tags != null) {
      this.chat = { ...this.chat, tags: e.tags };
    }
    const sidebarReloadActions = new Set(['pin', 'unpin', 'lock', 'unlock', 'tags-updated']);
    if (sidebarReloadActions.has(e.action)) {
      this.chatShell.triggerSidebarReload();
    }
    if (e.action === 'lock' && this.chat && this.chat.id === e.chatId) {
      this.chat = { ...this.chat, is_locked: true };
      return;
    }
    if (e.action === 'unlock' && this.chat && this.chat.id === e.chatId) {
      this.chat = { ...this.chat, is_locked: false };
      return;
    }
    if (e.action === 'pin' && this.chat && this.chat.id === e.chatId) {
      this.chat = { ...this.chat, is_pinned: true };
      return;
    }
    if (e.action === 'unpin' && this.chat && this.chat.id === e.chatId) {
      this.chat = { ...this.chat, is_pinned: false };
      return;
    }
  }

  onChatMetaUpdated(e: { chatId: number; name?: string; system_prompt?: string | null; response_style?: string | null }): void {
    if (this.chat && this.chat.id === e.chatId) {
      this.chat = {
        ...this.chat,
        ...(e.name != null ? { name: e.name } : {}),
        ...('system_prompt' in e ? { system_prompt: e.system_prompt ?? null } : {}),
        ...('response_style' in e ? { response_style: e.response_style ?? null } : {}),
      };
      if (e.name != null) this.chatShell.updateActiveChatName(e.name);
    }
  }

  // ── Voice (recorded by the composer; routed here) ──────────────
  /** Append the context flags to a generation FormData, omitting nulls (server default). */
  private _appendAudioContext(fd: FormData, audio: ComposerAudio): void {
    if (audio.retrieveContext != null) fd.append('retrieve_context', String(audio.retrieveContext));
    if (audio.processDocuments != null) fd.append('process_documents', String(audio.processDocuments));
  }

  onAudioCaptured(audio: ComposerAudio): void {
    const chatId = this.chatId;
    if (!chatId) { this.composer()?.finishVoiceProcessing(); return; }

    const formData = new FormData();
    formData.append('audio', audio.blob, 'recording.webm');

    const done = () => this.composer()?.finishVoiceProcessing();

    const voiceSuccess = (
      resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string },
      type: ArtifactType,
      toastMsg: string,
      fragments?: readonly ChatFragment[] | null,
    ) => {
      done();
      this.composer()?.resetToChat();
      this._pushGeneratedArtifact(resource, type, fragments);
      this.toast.show(toastMsg, 'success');
    };

    if (audio.mode === 'report') {
      formData.append('type', audio.reportType);
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateReport(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.report, 'REPORT', 'Informe generado.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar el informe.', 'error'); },
        });
      return;
    }

    if (audio.mode === 'checklist') {
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateChecklist(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.checklist, 'CHECKLIST', 'Checklist generada.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar la checklist.', 'error'); },
        });
      return;
    }

    if (audio.mode === 'quiz') {
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateQuiz(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.quiz, 'QUIZ', 'Quiz generado.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar el quiz.', 'error'); },
        });
      return;
    }

    if (audio.mode === 'timeline') {
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateTimeline(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.timeline, 'TIMELINE', 'Línea de tiempo generada.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar la línea de tiempo.', 'error'); },
        });
      return;
    }

    if (audio.mode === 'lessons-learned') {
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateLessonsLearned(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.lessons_learned, 'LESSONS_LEARNED', 'Lecciones aprendidas generadas.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar las lecciones aprendidas.', 'error'); },
        });
      return;
    }

    if (audio.mode === 'decision-brief') {
      this._appendAudioContext(formData, audio);
      formData.append('chat_id', String(chatId));
      this.http.generateDecisionBrief(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.decision_brief, 'DECISION_BRIEF', 'Brief de decisión generado.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar el brief de decisión.', 'error'); },
        });
      return;
    }

    // chat mode — transcribe only, then send via WS for full streaming
    this.http.transcribeAudio(chatId, formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          done();
          const text = res.transcript?.trim();
          if (!text) {
            this.toast.show('No se pudo obtener texto del audio.', 'error');
            return;
          }
          if (!this.socket) {
            this.toast.show('Sin conexión en tiempo real. Reconectá e intentá de nuevo.', 'error');
            return;
          }
          this.socket.sendUserMessage(text, audio.aiMode, {
            retrieveContext: audio.retrieveContext,
            processDocuments: audio.processDocuments,
          });
        },
        error: () => { done(); this.toast.show('No se pudo transcribir el audio.', 'error'); },
      });
  }

  ngOnDestroy(): void {
    this.teardownSocket();
    this.clearDeltaScheduling();
    this.chatShell.clearCurrentChat();
    this._messagesTopObserver?.disconnect();
    if (this._docReadyWaitHandle != null) {
      clearInterval(this._docReadyWaitHandle);
      this._docReadyWaitHandle = null;
    }
    if (this.copiedTimer != null) {
      clearTimeout(this.copiedTimer);
      this.copiedTimer = null;
    }
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
    return this.isTyping() || this.streamingAssistantId() !== null
      || this.sessionDocuments().some(d => d.status === 'uploaded');
  }

  sendChatMessage(
    rawText: string,
    aiMode: AuraChatAiMode,
    retrieveContext: boolean | null = null,
    processDocuments: boolean | null = null,
  ): void {
    const text = rawText.trim();
    if (!text || !this.chat || this.sendBlocked()) return;

    this.composer()?.clearText();

    const docIds = this.sessionDocuments().map((d) => d.id);
    if (docIds.length > 0) this.sessionDocuments.set([]);

    if (this.socket) {
      this.socket.sendUserMessage(text, aiMode, {
        documentIds: docIds.length > 0 ? docIds : undefined,
        retrieveContext,
        processDocuments,
      });
      setTimeout(() => this.scrollToBottom(), 50);
      return;
    }

    if (!this.chatId) return;
    this.isTyping.set(true);
    this.http
      .sendMessageJson(this.chatId, {
        chat_id: this.chatId!,
        message: text,
        mode: aiMode,
        retrieve_context: retrieveContext,
        process_documents: processDocuments,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const userRow: ChatMessage = {
            id: res.message.artifact_id ?? res.message.id,
            chat_id: res.message.chat_id,
            message: res.message.message,
            sender_type: res.message.sender_type,
            created_by: res.message.created_by,
            created_at: res.message.created_at,
            is_bookmarked: false,
            user_feedback: null,
            thread_reply_count: 0,
            artifactType: 'MESSAGE',
            messageId: res.message.id,
          };
          this.messages.update((m) => [...m, userRow]);
          if (res.assistant?.answer) {
            this.messages.update((m) => [
              ...m,
              {
                id: Date.now(),
                chat_id: this.chatId!,
                message: res.assistant!.answer,
                sender_type: 'assistant' as MessageSenderType,
                created_by: null,
                created_at: new Date().toISOString(),
                is_bookmarked: false,
                user_feedback: null,
                thread_reply_count: 0,
                artifactType: 'MESSAGE' as ArtifactType,
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

  private emitTypingStart(): void {
    if (!this.socket) return;
    this.socket.sendTyping(true);
    if (this.typingOutTimer != null) clearTimeout(this.typingOutTimer);
    this.typingOutTimer = setTimeout(() => {
      this.socket?.sendTyping(false);
      this.typingOutTimer = null;
    }, 2000);
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

  /** Texto a copiar: el cuerpo del mensaje, o la descripción/título si es un artefacto. */
  private copyTextFor(message: ChatMessage): string {
    if (message.artifactType === 'MESSAGE') return message.message ?? '';
    return message.artifactDescription || message.artifactTitle || message.message || '';
  }

  copyMessage(message: ChatMessage): void {
    const text = this.copyTextFor(message);
    if (!text) return;
    const done = () => {
      this.copiedMessageId.set(message.id);
      if (this.copiedTimer != null) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copiedMessageId.set(null);
        this.copiedTimer = null;
      }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this._fallbackCopy(text, done));
    } else {
      this._fallbackCopy(text, done);
    }
  }

  private _fallbackCopy(text: string, done: () => void): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      this.toast.show('No se pudo copiar.', 'error');
    }
  }

  deleteMessage(message: ChatMessage): void {
    this.pendingDeleteMessage.set(message);
  }

  cancelDelete(): void {
    this.pendingDeleteMessage.set(null);
  }

  confirmDelete(): void {
    const message = this.pendingDeleteMessage();
    if (!message) return;
    this.pendingDeleteMessage.set(null);
    this.setProcessing(message.id, true);
    this.http.deleteArtifact(message.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update((msgs) => msgs.filter((m) => m.id !== message.id));
          this.setProcessing(message.id, false);
        },
        error: () => {
          this.toast.show('No se pudo eliminar.', 'error');
          this.setProcessing(message.id, false);
        },
      });
  }

  canExport(message: ChatMessage): boolean {
    if (message.artifactType === 'MESSAGE') {
      return message.sender_type === 'assistant';
    }
    return true;
  }

  exportArtifact(message: ChatMessage, format: 'pdf' | 'markdown'): void {
    if (this.exportingMessageId() !== null) return;
    this.exportDropdownId.set(null);
    this.exportingMessageId.set(message.id);
    const lid = message.artifactLinkedId;
    let obs$: Observable<Blob> | null = null;
    switch (message.artifactType) {
      case 'MESSAGE': {
        const msgId = message.messageId ?? message.id;
        obs$ = format === 'pdf'
          ? this.http.exportArtifactMessagePdf(msgId)
          : this.http.exportArtifactMessageMarkdown(msgId);
        break;
      }
      case 'REPORT':
        if (lid) obs$ = format === 'pdf' ? this.http.exportReportPdf(lid) : this.http.exportReportMarkdown(lid);
        break;
      case 'CHECKLIST':
        if (lid) obs$ = format === 'pdf' ? this.http.exportChecklistPdf(lid) : this.http.exportChecklistMarkdown(lid);
        break;
      case 'QUIZ':
        if (lid) obs$ = format === 'pdf' ? this.http.exportQuizPdf(lid) : this.http.exportQuizMarkdown(lid);
        break;
      case 'TIMELINE':
        if (lid) obs$ = format === 'pdf' ? this.http.exportTimelinePdf(lid) : this.http.exportTimelineMarkdown(lid);
        break;
      case 'LESSONS_LEARNED':
        if (lid) obs$ = format === 'pdf' ? this.http.exportLessonsLearnedPdf(lid) : this.http.exportLessonsLearnedMarkdown(lid);
        break;
      case 'DECISION_BRIEF':
        if (lid) obs$ = format === 'pdf' ? this.http.exportDecisionBriefPdf(lid) : this.http.exportDecisionBriefMarkdown(lid);
        break;
      case 'DOCUMENT_SUMMARY':
        if (lid) obs$ = format === 'pdf' ? this.http.exportDocumentSummaryPdf(lid) : this.http.exportDocumentSummaryMarkdown(lid);
        break;
      case 'DOCUMENT_ACTION':
        if (lid) obs$ = format === 'pdf' ? this.http.exportDocumentActionPdf(lid) : this.http.exportDocumentActionMarkdown(lid);
        break;
    }
    if (!obs$) {
      this.exportingMessageId.set(null);
      this.toast.show('No se puede exportar este artefacto.', 'error');
      return;
    }
    const ext = format === 'pdf' ? 'pdf' : 'md';
    const slug = (message.artifactTitle || message.message || 'export').slice(0, 50).replace(/\s+/g, '-');
    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${slug}.${ext}`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        this.exportingMessageId.set(null);
      },
      error: () => {
        this.toast.show('No se pudo exportar.', 'error');
        this.exportingMessageId.set(null);
      },
    });
  }

  toggleBookmark(message: ChatMessage): void {
    this.setProcessing(message.id, true);
    const obs$ = message.is_bookmarked
      ? this.http.unbookmarkArtifact(message.id)
      : this.http.bookmarkArtifact(message.id);
    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const nowBookmarked = !message.is_bookmarked;
        this.messages.update((msgs) =>
          msgs.map((m) => (m.id === message.id ? { ...m, is_bookmarked: nowBookmarked } : m))
        );
        this.toast.show(nowBookmarked ? 'Mensaje guardado.' : 'Eliminado de guardados.', 'success');
        this.setProcessing(message.id, false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar el guardado.', 'error');
        this.setProcessing(message.id, false);
      },
    });
  }

  togglePinMessage(message: ChatMessage): void {
    const pinned = this.isPinned(message.id);
    this.setProcessing(message.id, true);
    const obs$ = pinned
      ? this.http.unpinArtifact(message.id)
      : this.http.pinArtifact(message.id);
    (obs$ as Observable<unknown>).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pinnedMessageIds.update((s) => {
          const next = new Set(s);
          pinned ? next.delete(message.id) : next.add(message.id);
          return next;
        });
        this.toast.show(pinned ? 'Mensaje desfijado.' : 'Mensaje fijado.', 'success');
        this.setProcessing(message.id, false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar el fijado.', 'error');
        this.setProcessing(message.id, false);
      },
    });
  }

  toggleThread(message: ChatMessage): void {
    if (this.activeThreadMessageId() === message.id) {
      this.closeThreadModal();
    } else {
      this.openThreadModal(message);
    }
  }

  openThreadModal(message: ChatMessage): void {
    this._disconnectThreadObserver();
    this.activeThreadMessageId.set(message.id);
    this.threadReplies.set([]);
    this.threadReplyText.set('');
    this.threadPage.set(1);
    this.threadHasMore.set(false);
    this.threadEditingReplyId.set(null);
    this.threadEditText.set('');
    this.loadThreadReplies(message.id, 1);
  }

  closeThreadModal(): void {
    this._disconnectThreadObserver();
    this.activeThreadMessageId.set(null);
    this.threadReplies.set([]);
    this.threadReplyText.set('');
    this.threadEditingReplyId.set(null);
    this.threadEditText.set('');
  }

  private _connectThreadObserver(): void {
    this._disconnectThreadObserver();
    const artifactId = this.activeThreadMessageId();
    if (artifactId == null) return;
    const body = this.threadScrollBodyRef()?.nativeElement;
    if (!body) return;
    const sentinel = body.querySelector('.thread-top-sentinel') as HTMLElement | null;
    if (!sentinel) return;
    // Use a short delay before connecting so the browser has time to apply the
    // scrollTop change and repaint. Without this, the observer may see the sentinel
    // as "intersecting" at the old (top) scroll position and immediately fire.
    requestAnimationFrame(() => {
      this._disconnectThreadObserver();
      const currentArtifactId = this.activeThreadMessageId();
      if (currentArtifactId == null) return;
      const currentBody = this.threadScrollBodyRef()?.nativeElement;
      if (!currentBody) return;
      const currentSentinel = currentBody.querySelector('.thread-top-sentinel') as HTMLElement | null;
      if (!currentSentinel) return;
      this._threadObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && this.threadHasMore() && !this.threadLoading()) {
            this._loadMoreOlderReplies(currentArtifactId);
          }
        },
        { root: currentBody, threshold: 0 },
      );
      this._threadObserver.observe(currentSentinel);
    });
  }

  private _disconnectThreadObserver(): void {
    this._threadObserver?.disconnect();
    this._threadObserver = null;
  }

  private _loadMoreOlderReplies(artifactId: number): void {
    const nextPage = this.threadPage() + 1;
    this.threadPage.set(nextPage);
    const body = this.threadScrollBodyRef()?.nativeElement;
    const savedScrollHeight = body?.scrollHeight ?? 0;
    this._disconnectThreadObserver();
    this.threadLoading.set(true);
    this.http
      .listArtifactThreadReplies(artifactId, { page: nextPage, page_size: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const older = [...result.results].reverse();
          this.threadReplies.update((r) => [...older, ...r]);
          this._resolveReplyUsers(older);
          this.threadHasMore.set(result.next != null);
          this.threadLoading.set(false);
          setTimeout(() => {
            if (body) body.scrollTop = body.scrollHeight - savedScrollHeight;
            this._connectThreadObserver();
          }, 50);
        },
        error: () => {
          this.toast.show('No se pudieron cargar las respuestas anteriores.', 'error');
          this.threadLoading.set(false);
          this._connectThreadObserver();
        },
      });
  }

  private loadThreadReplies(messageId: number, page = 1): void {
    this.threadLoading.set(true);
    this.http
      .listArtifactThreadReplies(messageId, { page, page_size: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.threadReplies.set([...result.results].reverse());
          this._resolveReplyUsers(result.results);
          this.threadHasMore.set(result.next != null);
          this.threadLoading.set(false);
          // Wait for Angular CD to render replies, then scroll to bottom before
          // connecting the observer (avoids immediate spurious trigger at top).
          setTimeout(() => {
            const body = this.threadScrollBodyRef()?.nativeElement;
            if (body) body.scrollTop = body.scrollHeight;
            this._connectThreadObserver();
          }, 50);
        },
        error: () => {
          this.toast.show('No se pudieron cargar las respuestas del hilo.', 'error');
          this.threadLoading.set(false);
        },
      });
  }

  /** Handle for a thread reply author (the template prepends "@"), resolving the id via the user cache. */
  threadAuthorName(userId: number): string {
    const sessionMemberId = this.chatShell.sessionViewerMemberId();
    if (sessionMemberId != null && userId === sessionMemberId) {
      const n = this.chatShell.sessionViewerDisplayName();
      return n?.trim() ? n.trim() : 'vos';
    }
    const u = this.messageUserMap().get(userId);
    if (u) return u.username?.trim() || u.name?.trim() || `usuario-${userId}`;
    return `usuario-${userId}`;
  }

  private _resolveReplyUsers(replies: readonly ThreadReplyDto[]): void {
    const ids = [...new Set(replies.map((r) => r.created_by).filter((id): id is number => id != null))];
    if (ids.length === 0) return;
    this.userCache.resolve(ids).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (userMap) => {
        this.messageUserMap.update((prev) => {
          const next = new Map(prev);
          userMap.forEach((u, id) => next.set(id, { username: u.username, name: u.name }));
          return next;
        });
      },
    });
  }

  startEditReply(reply: ThreadReplyDto): void {
    this.threadEditingReplyId.set(reply.id);
    this.threadEditText.set(reply.message);
  }

  cancelEditReply(): void {
    this.threadEditingReplyId.set(null);
    this.threadEditText.set('');
  }

  submitEditReply(artifactId: number, replyId: number): void {
    const text = this.threadEditText().trim();
    if (!text || this.updatingReply()) return;
    this.updatingReply.set(true);
    this.http
      .updateArtifactThreadReply(artifactId, replyId, { message: text })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.threadReplies.update((rs) => rs.map((r) => (r.id === replyId ? updated : r)));
          this.threadEditingReplyId.set(null);
          this.threadEditText.set('');
          this.updatingReply.set(false);
        },
        error: () => {
          this.toast.show('No se pudo actualizar la respuesta.', 'error');
          this.updatingReply.set(false);
        },
      });
  }

  deleteThreadReply(artifactId: number, replyId: number): void {
    if (this.deletingReplyIds().has(replyId)) return;
    this.deletingReplyIds.update((s) => new Set([...s, replyId]));
    this.http
      .deleteArtifactThreadReply(artifactId, replyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.threadReplies.update((rs) => rs.filter((r) => r.id !== replyId));
          const id = this.activeThreadMessageId();
          if (id != null) {
            this.messages.update((msgs) =>
              msgs.map((m) =>
                m.id === id ? { ...m, thread_reply_count: Math.max(0, m.thread_reply_count - 1) } : m
              )
            );
          }
          this.deletingReplyIds.update((s) => { const n = new Set(s); n.delete(replyId); return n; });
        },
        error: () => {
          this.toast.show('No se pudo eliminar la respuesta.', 'error');
          this.deletingReplyIds.update((s) => { const n = new Set(s); n.delete(replyId); return n; });
        },
      });
  }

  submitThreadReply(messageId: number): void {
    if (!this.threadReplyText().trim() || this.submittingReply()) return;
    const text = this.threadReplyText().trim();
    this.submittingReply.set(true);
    this.http
      .addArtifactThreadReply(messageId, { message: text })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reply) => {
          this.threadReplies.update((r) => [...r, reply]);
          this._resolveReplyUsers([reply]);
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === messageId ? { ...m, thread_reply_count: m.thread_reply_count + 1 } : m
            )
          );
          this.threadReplyText.set('');
          this.submittingReply.set(false);
          setTimeout(() => {
            const body = this.threadScrollBodyRef()?.nativeElement;
            if (body) body.scrollTop = body.scrollHeight;
          }, 50);
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
    const isToggleOff = message.user_feedback === value;

    if (isToggleOff) {
      this.removeFeedback(message.id);
      return;
    }

    // Thumbs down: ask for an optional reason/comment first.
    if (value === -1) {
      this.feedbackDialogMessageId.set(message.id);
      return;
    }

    this.submitFeedback(message.id, 1, null, null);
  }

  onFeedbackDialogSubmit(result: DislikeFeedbackResult): void {
    const messageId = this.feedbackDialogMessageId();
    this.feedbackDialogMessageId.set(null);
    if (messageId == null) return;
    this.submitFeedback(messageId, -1, result.reason, result.comment);
  }

  onFeedbackDialogCancel(): void {
    this.feedbackDialogMessageId.set(null);
  }

  private submitFeedback(
    messageId: number,
    value: FeedbackValue,
    reason: FeedbackReason | null,
    comment: string | null
  ): void {
    this.setProcessing(messageId, true);
    this.http
      .setArtifactFeedback(messageId, { value, reason, comment })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === messageId
                ? { ...m, user_feedback: value, user_feedback_reason: reason, user_feedback_comment: comment }
                : m
            )
          );
          this.setProcessing(messageId, false);
        },
        error: () => {
          this.toast.show('No se pudo registrar el feedback.', 'error');
          this.setProcessing(messageId, false);
        },
      });
  }

  private removeFeedback(messageId: number): void {
    this.setProcessing(messageId, true);
    this.http
      .deleteArtifactFeedback(messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === messageId
                ? { ...m, user_feedback: null, user_feedback_reason: null, user_feedback_comment: null }
                : m
            )
          );
          this.setProcessing(messageId, false);
        },
        error: () => {
          this.toast.show('No se pudo registrar el feedback.', 'error');
          this.setProcessing(messageId, false);
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
    if (message.created_by != null) {
      const u = this.messageUserMap().get(message.created_by);
      if (u) return this.initialsFromDisplayName(u.name?.trim() || u.username);
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
    if (message.created_by != null) {
      const u = this.messageUserMap().get(message.created_by);
      if (u) {
        const display = u.name?.trim() ? u.name.trim() : `@${u.username}`;
        return display;
      }
    }
    return message.created_by != null ? `Participante · id ${message.created_by}` : 'Usuario';
  }

  private initialsFromDisplayName(raw: string): string {
    // Separa por espacios y por los separadores típicos de username (. _ -),
    // así "ten.lopez" rinde "TL" (inicial del nombre + inicial del apellido)
    // en lugar de "TE".
    const parts = raw.trim().split(/[\s._-]+/).filter(Boolean);
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
      // RAG / tool agent pipeline steps
      analyze: 'Analizando la consulta…',
      analysis: 'Analizando la consulta…',
      retrieve: 'Recuperando contexto documental…',
      retrieval: 'Recuperando contexto documental…',
      evaluate: 'Evaluando la información…',
      evaluation: 'Evaluando la información…',
      reason: 'Razonando sobre la respuesta…',
      reasoning: 'Razonando sobre la respuesta…',
      synthesize: 'Sintetizando la respuesta…',
      synthesis: 'Sintetizando la respuesta…',
      tool_call: 'Usando herramientas…',
      tool_execution: 'Ejecutando herramientas…',
      planning: 'Planificando…',
    };
    return step ? (labels[step] ?? step) : '';
  }

  isMessageItem(msg: ChatMessage): boolean {
    return msg.artifactType === 'MESSAGE';
  }

  artifactTypeLabel(type: ArtifactType): string {
    const labels: Record<ArtifactType, string> = {
      MESSAGE: 'Mensaje',
      REPORT: 'Informe',
      CHECKLIST: 'Checklist',
      QUIZ: 'Quiz',
      TIMELINE: 'Línea de tiempo',
      LESSONS_LEARNED: 'Lecciones aprendidas',
      DECISION_BRIEF: 'Decisión',
      DOCUMENT_SUMMARY: 'Resumen de documentos',
      DOCUMENT_ACTION: 'Acción sobre documentos',
    };
    return labels[type] ?? type;
  }

  artifactTypeIcon(type: ArtifactType): string {
    const icons: Record<ArtifactType, string> = {
      MESSAGE: 'pi-comment',
      REPORT: 'pi-file-edit',
      CHECKLIST: 'pi-check-square',
      QUIZ: 'pi-question-circle',
      TIMELINE: 'pi-calendar',
      LESSONS_LEARNED: 'pi-book',
      DECISION_BRIEF: 'pi-bolt',
      DOCUMENT_SUMMARY: 'pi-align-left',
      DOCUMENT_ACTION: 'pi-cog',
    };
    return icons[type] ?? 'pi-file';
  }

  async navigateToLinkedArtifact(message: ChatMessage): Promise<void> {
    if (this.resolvingLinkedId() !== null) return;

    let contentId = message.artifactLinkedId;

    if (contentId == null) {
      contentId = await this._resolveLinkedId(message);
      if (contentId == null) {
        this.toast.show('No se pudo obtener el ID del artefacto.', 'error');
        return;
      }
      this.messages.update((msgs) =>
        msgs.map((m) => (m.id === message.id ? { ...m, artifactLinkedId: contentId } : m))
      );
    }

    const routeMap: Partial<Record<ArtifactType, string>> = {
      REPORT: 'report',
      CHECKLIST: 'checklist',
      QUIZ: 'quiz',
      TIMELINE: 'timeline',
      LESSONS_LEARNED: 'lessons-learned',
      DECISION_BRIEF: 'decision-brief',
      DOCUMENT_SUMMARY: 'document-summary',
      DOCUMENT_ACTION: 'document-action',
    };
    const segment = routeMap[message.artifactType];
    if (segment) {
      void this.router.navigate(['/', segment, contentId]);
    }
  }

  private async _resolveLinkedId(message: ChatMessage): Promise<number | null> {
    const chatId = this.chatId;
    if (!chatId) return null;
    this.resolvingLinkedId.set(message.id);
    try {
      if (message.artifactType === 'DOCUMENT_SUMMARY') {
        const page = await firstValueFrom(
          this.http.listDocumentSummaries({ chat_id: chatId, page_size: 100 })
        );
        return page.results.find((x) => x.artifact_id === message.id)?.id ?? null;
      }
      if (message.artifactType === 'DOCUMENT_ACTION') {
        const page = await firstValueFrom(
          this.http.listDocumentActions({ chat_id: chatId, page_size: 100 })
        );
        return page.results.find((x) => x.artifact_id === message.id)?.id ?? null;
      }
      return null;
    } catch {
      return null;
    } finally {
      this.resolvingLinkedId.set(null);
    }
  }

  /** Unique source documents per message id (fragments collapsed by document). */
  readonly sourceDocsByMessage = computed(() => {
    const out = new Map<number, SourceDocument[]>();
    this.messageFragments().forEach((frags, msgId) => {
      out.set(msgId, this._dedupeSourceDocuments(frags));
    });
    return out;
  });

  private _dedupeSourceDocuments(frags: readonly ChatFragment[]): SourceDocument[] {
    const byDoc = new Map<number, { id: number; name: string; type: string | null; category: string | null; matched: number }>();
    for (const f of frags) {
      const doc = f.document;
      const docId = doc?.id ?? f.document_id;
      if (docId == null) continue;
      const existing = byDoc.get(docId);
      if (existing) {
        existing.matched += 1;
      } else {
        byDoc.set(docId, {
          id: docId,
          name: doc?.name ?? `Documento ${docId}`,
          type: doc?.type ?? null,
          category: doc?.category ?? null,
          matched: 1,
        });
      }
    }
    return [...byDoc.values()];
  }

  hasFragments(id: number): boolean {
    return (this.sourceDocsByMessage().get(id)?.length ?? 0) > 0;
  }

  getSourceDocuments(id: number): readonly SourceDocument[] {
    return this.sourceDocsByMessage().get(id) ?? [];
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

  readonly downloadingSourceId = signal<number | null>(null);

  sourceDocIcon(doc: SourceDocument): string {
    const t = (doc.type ?? '').toLowerCase();
    if (t.includes('pdf')) return 'pi-file-pdf';
    if (t.includes('word') || t.includes('doc')) return 'pi-file-word';
    if (t.includes('sheet') || t.includes('excel') || t.includes('csv') || t.includes('xls')) return 'pi-file-excel';
    return 'pi-file';
  }

  downloadSourceDocument(doc: SourceDocument): void {
    if (this.downloadingSourceId() !== null) return;
    this.downloadingSourceId.set(doc.id);
    this.documents.downloadDocument(doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.downloadingSourceId.set(null);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = doc.name;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => {
          this.downloadingSourceId.set(null);
          this.toast.show('No se pudo descargar el documento.', 'error');
        },
      });
  }

  private _resolveMessageUsers(msgs: readonly ChatMessage[]): void {
    const ids = [...new Set(msgs.map((m) => m.created_by).filter((id): id is number => id != null))];
    if (ids.length === 0) return;
    this.userCache.resolve(ids).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (userMap) => {
        this.messageUserMap.update((prev) => {
          const next = new Map(prev);
          userMap.forEach((u, id) => next.set(id, { username: u.username, name: u.name }));
          return next;
        });
      },
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

  private consumePendingAiModeFromHistory(): AuraChatAiMode | undefined {
    const navState = history.state as { pendingAiMode?: unknown } | null;
    const raw = navState?.pendingAiMode;
    if (navState && 'pendingAiMode' in navState) {
      const { pendingAiMode: _m, ...rest } = navState;
      history.replaceState(rest, '');
    }
    const validModes: readonly AuraChatAiMode[] = ['document_question', 'general_chat', 'rag_agent'];
    return validModes.some((m) => m === raw) ? (raw as AuraChatAiMode) : undefined;
  }

  private consumePendingChatFlagsFromHistory(): { retrieveContext: boolean | null; processDocuments: boolean | null } {
    const navState = history.state as { pendingRetrieveContext?: unknown; pendingProcessDocuments?: unknown } | null;
    const flags = {
      retrieveContext: navState?.pendingRetrieveContext === true ? true : null,
      processDocuments: navState?.pendingProcessDocuments === true ? true : null,
    };
    if (navState && ('pendingRetrieveContext' in navState || 'pendingProcessDocuments' in navState)) {
      const { pendingRetrieveContext: _r, pendingProcessDocuments: _p, ...rest } = navState;
      history.replaceState(rest, '');
    }
    return flags;
  }

  private consumePendingGenerationFromHistory(): {
    mode: 'report' | 'checklist' | 'quiz' | 'timeline' | 'lessons-learned' | 'decision-brief' | 'document-summary' | 'document-action';
    type?: ReportType;
    retrieveContext: boolean | null;
    processDocuments: boolean | null;
    message: string;
  } | undefined {
    const navState = history.state as Record<string, unknown> | null;
    const raw = navState?.['pendingGeneration'];
    if (navState && 'pendingGeneration' in (navState ?? {})) {
      const { pendingGeneration: _g, ...rest } = navState as Record<string, unknown>;
      history.replaceState(rest, '');
    }
    if (!raw || typeof raw !== 'object') return undefined;
    const g = raw as Record<string, unknown>;
    const validModes = ['report', 'checklist', 'quiz', 'timeline', 'lessons-learned', 'decision-brief', 'document-summary', 'document-action'] as const;
    if (!validModes.includes(g['mode'] as typeof validModes[number])) return undefined;
    const triState = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
    return {
      mode: g['mode'] as typeof validModes[number],
      type: g['type'] as ReportType | undefined,
      retrieveContext: triState(g['retrieveContext']),
      processDocuments: triState(g['processDocuments']),
      message: String(g['message'] ?? ''),
    };
  }

  /**
   * Documentos subidos en la pantalla de inicio justo antes de crear el chat.
   * Se siembran en `sessionDocuments` para que el primer mensaje/artefacto los
   * adjunte, y se les arranca el polling de estado si aún están procesándose.
   */
  private seedPendingDocuments(): void {
    const docs = this.consumePendingDocumentsFromHistory();
    if (docs.length === 0) return;
    const now = new Date().toISOString();
    this.sessionDocuments.set(
      docs.map((d) => ({ id: d.id, name: d.name, status: d.status, created_at: now })),
    );
    docs.forEach((d) => {
      if (d.status !== 'processed' && d.status !== 'failed') this._startDocumentPolling(d.id);
    });
  }

  private consumePendingDocumentsFromHistory(): { id: number; name: string; status: string }[] {
    const navState = history.state as { pendingDocuments?: unknown } | null;
    const raw = navState?.pendingDocuments;
    if (navState && 'pendingDocuments' in navState) {
      const { pendingDocuments: _d, ...rest } = navState;
      history.replaceState(rest, '');
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (d): d is { id: number; name?: unknown; status?: unknown } =>
          !!d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'number',
      )
      .map((d) => ({ id: d.id, name: String(d.name ?? ''), status: String(d.status ?? 'processing') }));
  }

  /**
   * Espera a que los documentos sembrados desde el inicio terminen de procesarse
   * (status terminal: `processed`/`failed`) antes de disparar el primer mensaje o
   * la generación, para que el backend tenga los fragmentos listos. Resuelve de
   * inmediato si no hay docs o ya están listos, sale si cambia la sesión, y tiene
   * timeout de fallback para no quedar colgado indefinidamente.
   */
  private waitForSeededDocsReady(sessionId: number, maxMs = 90_000): Promise<void> {
    const isDone = (): boolean => {
      if (this.wsSessionId !== sessionId) return true;
      return this.sessionDocuments().every((d) => d.status === 'processed' || d.status === 'failed');
    };
    if (this.sessionDocuments().length === 0 || isDone()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const handle = setInterval(() => {
        if (isDone() || Date.now() - start > maxMs) {
          clearInterval(handle);
          if (this._docReadyWaitHandle === handle) this._docReadyWaitHandle = null;
          resolve();
        }
      }, 400);
      this._docReadyWaitHandle = handle;
    });
  }

  private async openWebSocketAfterLoad(expectedChatId: number, sessionId: number, pending?: string): Promise<void> {
    if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) return;
    // Refrescá el token si está por vencer antes de abrir el WS (que lo toma una
    // sola vez y no pasa por el interceptor). Cubre el caso de actividad sólo-WS.
    const token = await firstValueFrom(this.auth.ensureFreshToken());
    if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) return;
    const conn = this.wsFactory.open(expectedChatId, token);
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
      if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) {
        return;
      }
      if (pending?.trim()) {
        this.toast.show('No se pudo conectar el chat en tiempo real. Probá enviar de nuevo.', 'error');
      }
      return;
    }

    if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) {
      conn.close();
      return;
    }

    if (pending?.trim()) {
      // Esperá a que los documentos sembrados terminen de procesarse para que el
      // primer mensaje los adjunte con los fragmentos ya disponibles.
      await this.waitForSeededDocsReady(sessionId);
      if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) return;
      const docIds = this.sessionDocuments().map((d) => d.id);
      conn.sendUserMessage(pending.trim(), this.aiMode(), {
        documentIds: docIds.length > 0 ? docIds : undefined,
        retrieveContext: this._pendingChatOptions.retrieveContext,
        processDocuments: this._pendingChatOptions.processDocuments,
      });
      if (docIds.length > 0) this.sessionDocuments.set([]);
      this._pendingChatOptions = { retrieveContext: null, processDocuments: null };
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

  /** Avanza el puntero de lectura del chat en el backend (idempotente, errores ignorados). */
  private markCurrentChatRead(chatId: number): void {
    this.http.markChatAsRead(chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => { /* no crítico */ } });
  }

  private handleWsMessage(msg: AuraChatWsServerMessage): void {
    const cid = this.chatId;
    if (cid == null) return;
    switch (msg.type) {
      case 'user_message': {
        // El `id` de la fila debe ser el `artifact_id` (igual que al recargar vía
        // `_artifactToMessage`); si el eco trae sólo el id del mensaje caería en
        // un dedup erróneo contra los artifact_id ya cargados y no se mostraría.
        const row: ChatMessage = {
          id: msg.artifact_id ?? msg.id,
          chat_id: cid,
          message: msg.message,
          sender_type: msg.sender_type as MessageSenderType,
          created_by: msg.created_by,
          created_at: msg.created_at,
          is_bookmarked: false,
          user_feedback: null,
          thread_reply_count: 0,
          artifactType: 'MESSAGE',
          messageId: msg.id,
        };
        this.messages.update((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
        if (row.created_by != null) this._resolveMessageUsers([row]);
        // Mensaje de otro participante mientras mirás el chat: queda leído.
        if (row.created_by != null && row.created_by !== this.currentUserId()) {
          this.markCurrentChatRead(cid);
        }
        setTimeout(() => this.scrollToBottom(), 50);
        break;
      }
      case 'ai_meta':
        this.isTyping.set(true);
        break;
      case 'ai_progress':
        this.aiProgressStep.set(msg.step);
        this.aiProgressMessage.set(msg.message?.trim() || null);
        this.cdr.markForCheck();
        break;
      case 'ai_delta': {
        const delta = msg.delta ?? '';
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.aiProgressMessage.set(null);
        this.scheduleDeltaApply(cid, delta);
        break;
      }
      case 'ai_complete': {
        this.flushPendingDeltas();
        const text = msg.answer || msg.message || '';
        const sid = this.streamingAssistantId();
        const aiSenderType: MessageSenderType = (msg.sender_type as MessageSenderType | undefined) ?? 'assistant';
        // Como en `_artifactToMessage`, la fila se identifica por `artifact_id`;
        // el id del mensaje queda en `messageId` (lo usa la exportación).
        const completedId = msg.artifact_id ?? msg.id ?? null;
        if (sid != null && completedId != null) {
          this.messages.update((list) =>
            list.map((m) =>
              m.id === sid
                ? {
                    id: completedId,
                    chat_id: cid,
                    message: text,
                    sender_type: aiSenderType,
                    created_by: msg.created_by ?? null,
                    created_at: msg.created_at ?? new Date().toISOString(),
                    is_bookmarked: false,
                    user_feedback: null,
                    thread_reply_count: 0,
                    artifactType: 'MESSAGE' as ArtifactType,
                    messageId: msg.id,
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
              id: completedId ?? Date.now(),
              chat_id: cid,
              message: text,
              sender_type: aiSenderType,
              created_by: msg.created_by ?? null,
              created_at: msg.created_at ?? new Date().toISOString(),
              is_bookmarked: false,
              user_feedback: null,
              thread_reply_count: 0,
              artifactType: 'MESSAGE' as ArtifactType,
              messageId: msg.id,
            },
          ]);
        }
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.aiProgressMessage.set(null);

        if (msg.fragments?.length) {
          const fragId = completedId ?? sid ?? Date.now();
          this.messageFragments.update((m) => {
            const n = new Map(m);
            n.set(fragId as number, msg.fragments);
            return n;
          });
        }
        // Estás viendo el chat: la respuesta recién llegada ya está leída.
        // Avanzá el puntero en el backend para que no quede marcado no leído
        // en la sidebar al salir.
        this.markCurrentChatRead(cid);
        setTimeout(() => this.scrollToBottom(), 50);
        this.cdr.markForCheck();
        break;
      }
      case 'ai_error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.aiProgressMessage.set(null);

        this.toast.show(msg.detail, 'error');
        this.cdr.markForCheck();
        break;
      case 'error':
        this.flushPendingDeltas();
        this.streamingAssistantId.set(null);
        this.isTyping.set(false);
        this.aiProgressStep.set(null);
        this.aiProgressMessage.set(null);

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
      case 'chat_ai_lock':
        if (msg.locked) {
          this.isTyping.set(true);
        } else {
          // Lock released without an ai_complete — clear processing indicators.
          if (this.streamingAssistantId() === null) {
            this.isTyping.set(false);
            this.aiProgressStep.set(null);
            this.aiProgressMessage.set(null);
          }
        }
        this.cdr.markForCheck();
        break;
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
          sender_type: 'assistant' as MessageSenderType,
          created_by: null,
          created_at: new Date().toISOString(),
          is_bookmarked: false,
          user_feedback: null,
          thread_reply_count: 0,
          artifactType: 'MESSAGE' as ArtifactType,
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
    const el = this.messagesContainerRef()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
