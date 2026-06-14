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
  ChecklistMode,
  DecisionBriefMode,
  DocumentActionType,
  FeedbackReason,
  FeedbackValue,
  LessonsLearnedMode,
  MessageSenderType,
  PageNumberResult,
  PinnedArtifactDto,
  QuizMode,
  ReportMode,
  ReportType,
  ThreadReplyDto,
  TimelineMode,
} from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_AI_MODE_DEFAULT } from '@aura-types/aura-chat-service.types';
import { ChatService } from '@core/services/chat/chat.service';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ChatWebSocketService, type ChatSocketConnection } from '@core/services/websocket/chat-websocket.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import { ChatOptionsDrawer, type DocumentItem } from '../chat-options-drawer/chat-options-drawer';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { TokenMaterializeDirective } from '../../../../shared/directives/token-materialize.directive';
import { UserState } from '@core/state/user.state';
import { UserCacheService } from '@core/services/user-cache.service';
import {
  FeedbackDialog,
  type DislikeFeedbackResult,
} from '../feedback-dialog/feedback-dialog';

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

const REPORT_TYPES: readonly { value: ReportType; label: string; placeholder: string }[] = [
  { value: 'SITREP', label: 'SITREP — Situación', placeholder: 'Describí la situación, unidades involucradas, área de operaciones…' },
  { value: 'INTSUM', label: 'INTSUM — Inteligencia', placeholder: 'Describí la amenaza, período cubierto, eventos relevantes…' },
  { value: 'OPORD', label: 'OPORD — Operaciones', placeholder: 'Describí la misión, situación, plan de ejecución…' },
];

interface AiModeOption {
  readonly value: AuraChatAiMode;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
  readonly permission: string | null;
}

const AI_MODES: readonly AiModeOption[] = [
  { value: 'document_question', label: 'Documentos', icon: 'pi-database', hint: 'Responde usando tus documentos (RAG).', permission: null },
  { value: 'general_chat', label: 'General', icon: 'pi-comment', hint: 'Asistente general, sin documentos.', permission: 'LLM_GENERAL_CHAT' },
  { value: 'rag_agent', label: 'Agente RAG', icon: 'pi-sitemap', hint: 'Pipeline RAG avanzado con razonamiento.', permission: 'LLM_AGENT' },
  { value: 'agent', label: 'Agente', icon: 'pi-bolt', hint: 'Agente con herramientas sobre documentos.', permission: 'LLM_AGENT' },
];

@Component({
  selector: 'app-chat-session',
  standalone: true,
  imports: [CommonModule, FormsModule, BtnIcon, ChatOptionsDrawer, MarkdownPipe, TokenMaterializeDirective, FeedbackDialog],
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

  readonly canUseTools = computed(() => {
    const perms = this.userState.user()?.permissions ?? [];
    return (
      perms.includes('LLM_REPORT_GENERATE') ||
      perms.includes('LLM_CHECKLIST_GENERATE') ||
      perms.includes('LLM_QUIZ_GENERATE') ||
      perms.includes('LLM_TIMELINE_GENERATE') ||
      perms.includes('LLM_LESSONS_LEARNED_GENERATE') ||
      perms.includes('LLM_DECISION_BRIEF_GENERATE') ||
      perms.includes('LLM_DOCUMENT_SUMMARY_GENERATE') ||
      perms.includes('LLM_DOCUMENT_ACTION_GENERATE')
    );
  });

  readonly canReport            = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_REPORT_GENERATE'));
  readonly canChecklist         = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_CHECKLIST_GENERATE'));
  readonly canQuiz              = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_QUIZ_GENERATE'));
  readonly canTimeline          = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_TIMELINE_GENERATE'));
  readonly canLessonsLearned    = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_LESSONS_LEARNED_GENERATE'));
  readonly canDecisionBrief     = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_DECISION_BRIEF_GENERATE'));
  readonly canDocumentSummary   = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_DOCUMENT_SUMMARY_GENERATE'));
  readonly canDocumentAction    = computed(() => (this.userState.user()?.permissions ?? []).includes('LLM_DOCUMENT_ACTION_GENERATE'));

  private chatId: number | null = null;
  private wsSessionId = 0;
  private socket: ChatSocketConnection | null = null;
  private wsMessagesSub: Subscription | undefined;
  private typingOutTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly peerTypingTimers = new Map<number, ReturnType<typeof setTimeout>>();

  // ── Voice recording ──────────────────────────────────────────
  readonly voiceState = signal<'idle' | 'recording' | 'processing'>('idle');
  readonly recordingSeconds = signal(0);
  private _mediaRecorder: MediaRecorder | null = null;
  private _audioChunks: Blob[] = [];
  private _recordingTimer: ReturnType<typeof setInterval> | null = null;

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
  readonly messageFragments = signal<Map<number, readonly ChatFragment[]>>(new Map());
  readonly expandedFragmentIds = signal<Set<number>>(new Set());

  chat: ChatDetailDto | null = null;
  messages = signal<ChatMessage[]>([]);
  readonly messageUserMap = signal<Map<number, { username: string; name: string }>>(new Map());
  newMessage = '';
  loading = true;
  isTyping = signal(false);
  optionsOpen = signal(false);
  readonly composerMode = signal<'chat' | 'report' | 'checklist' | 'quiz' | 'timeline' | 'lessons-learned' | 'decision-brief' | 'document-summary' | 'document-action'>('chat');
  readonly genDocumentActionType = signal<DocumentActionType | ''>('');

  // ── AI chat mode (document_question / general_chat / rag_agent / agent) ──
  readonly aiModes = AI_MODES;
  readonly aiMode = signal<AuraChatAiMode>(AURA_CHAT_AI_MODE_DEFAULT);
  readonly aiModeDropdownOpen = signal(false);
  readonly availableAiModes = computed(() => {
    const perms = this.userState.user()?.permissions ?? [];
    return AI_MODES.filter((m) => m.permission === null || perms.includes(m.permission));
  });
  readonly showAiModeSelector = computed(() => this.availableAiModes().length > 1);
  readonly activeAiMode = computed(
    () => AI_MODES.find((m) => m.value === this.aiMode()) ?? AI_MODES[0],
  );

  readonly genReportType = signal<ReportType>('SITREP');
  readonly genMode = signal<'direct' | 'rag'>('direct');
  readonly genMessage = signal('');
  readonly genLoading = signal(false);
  readonly modeDropdownOpen = signal(false);

  readonly reportTypes = REPORT_TYPES;

  readonly composerModeLabel = computed(() => {
    switch (this.composerMode()) {
      case 'report':           return { icon: 'pi-file-edit',       label: 'Informe' };
      case 'checklist':        return { icon: 'pi-check-square',    label: 'Checklist' };
      case 'quiz':             return { icon: 'pi-question-circle', label: 'Quiz' };
      case 'timeline':         return { icon: 'pi-calendar',        label: 'Línea de tiempo' };
      case 'lessons-learned':  return { icon: 'pi-book',            label: 'Lecciones' };
      case 'decision-brief':   return { icon: 'pi-bolt',            label: 'Decisión' };
      case 'document-summary': return { icon: 'pi-align-left',      label: 'Resumen' };
      case 'document-action':  return { icon: 'pi-cog',             label: 'Acción' };
      default:                 return { icon: 'pi-comments',        label: 'Chat' };
    }
  });

  readonly genTextareaPlaceholder = computed(() => {
    switch (this.composerMode()) {
      case 'checklist':        return 'Describí el procedimiento o SOP a convertir en checklist…';
      case 'quiz':             return 'Describí el tema para el que querés generar preguntas de evaluación…';
      case 'timeline':         return 'Describí la secuencia de eventos a ordenar cronológicamente…';
      case 'lessons-learned':  return 'Describí el ejercicio o actividad cuyos aprendizajes querés capturar…';
      case 'decision-brief':   return 'Describí el problema y las alternativas a evaluar…';
      case 'document-action':  return 'Describí la instrucción o tarea a ejecutar sobre los documentos…';
      default:                 return REPORT_TYPES.find((t) => t.value === this.genReportType())?.placeholder ?? 'Ingresá el contenido…';
    }
  });

  readonly hasProcessingDocs = computed(() =>
    this.sessionDocuments().some(d => d.status === 'uploaded'),
  );

  readonly canGenerate = computed(() => {
    const mode = this.composerMode();
    if (this.genLoading()) return false;
    const docs = this.sessionDocuments();
    const allDocsReady = docs.every(d => d.status === 'processed');
    if (mode === 'document-summary') return docs.length > 0 && allDocsReady;
    if (mode === 'document-action') return docs.length > 0 && allDocsReady && this.genMessage().trim().length > 0;
    return this.genMessage().trim().length > 0;
  });

  documentUploading = signal(false);
  readonly docDropOverlayVisible = signal(false);
  readonly sessionDocuments = signal<DocumentItem[]>([]);

  private readonly _docPolls = new Map<number, Subject<void>>();
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
          const sessionId = ++this.wsSessionId;
          this.docDropOverlayVisible.set(false);
          this.sessionDocuments.set([]);
          this.composerMode.set('chat');
          this.genMessage.set('');
          this.modeDropdownOpen.set(false);
          this.aiMode.set(AURA_CHAT_AI_MODE_DEFAULT);
          this.aiModeDropdownOpen.set(false);
          this.loading = true;
          this.chat = null;
          this.messages.set([]);

          const pending = this.consumePendingMessageFromHistory();
          const pendingAiMode = this.consumePendingAiModeFromHistory();
          if (pendingAiMode) {
            this.aiMode.set(pendingAiMode);
          }

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
              setTimeout(() => {
                this.scrollToBottom();
                this._setupMessagesTopObserver();
              }, 100);
              queueMicrotask(() => this.autosizeTextarea());

              const gen = this.consumePendingGenerationFromHistory();
              if (gen) {
                this.composerMode.set(gen.mode);
                this.genMode.set(gen.genMode);
                this.genMessage.set(gen.message);
                if (gen.type) this.genReportType.set(gen.type);
                setTimeout(() => this.generateTool(), 100);
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

  toggleModeDropdown(): void {
    this.modeDropdownOpen.update((v) => !v);
  }

  setComposerMode(mode: 'chat' | 'report' | 'checklist' | 'quiz' | 'timeline' | 'lessons-learned' | 'decision-brief' | 'document-summary' | 'document-action'): void {
    this.composerMode.set(mode);
    this.genMessage.set('');
    this.genMode.set('direct');
    this.genDocumentActionType.set('');
    this.modeDropdownOpen.set(false);
    if (mode === 'chat') {
      setTimeout(() => this.messageBox()?.nativeElement.focus(), 50);
    }
  }

  onGenTypeChange(value: string): void {
    this.genReportType.set(value as ReportType);
  }

  toggleAiModeDropdown(): void {
    this.aiModeDropdownOpen.update((v) => !v);
  }

  setAiMode(mode: AuraChatAiMode): void {
    this.aiMode.set(mode);
    this.aiModeDropdownOpen.set(false);
    setTimeout(() => this.messageBox()?.nativeElement.focus(), 50);
  }

  generateTool(): void {
    const message = this.genMessage().trim();
    const composerMode = this.composerMode();
    if (!message && composerMode !== 'document-summary') return;

    const chatId = this.chatId ?? undefined;
    const mode = this.genMode();
    this.genLoading.set(true);

    const onSuccess = (
      resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string; mode: string },
      type: ArtifactType,
      toastMsg: string,
      fragments?: readonly ChatFragment[] | null,
    ) => {
      this.genLoading.set(false);
      this.genMessage.set('');
      this.composerMode.set('chat');
      this._pushGeneratedArtifact(resource, type, fragments);
      this.toast.show(toastMsg, 'success');
    };

    const onError = (toastMsg: string) => {
      this.genLoading.set(false);
      this.toast.show(toastMsg, 'error');
    };

    if (composerMode === 'checklist') {
      this.http.generateChecklist({ mode: mode as ChecklistMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.checklist, 'CHECKLIST', 'Checklist generada.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar la checklist.'),
        });
      return;
    }

    if (composerMode === 'quiz') {
      this.http.generateQuiz({ mode: mode as QuizMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.quiz, 'QUIZ', 'Quiz generado.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar el quiz.'),
        });
      return;
    }

    if (composerMode === 'timeline') {
      this.http.generateTimeline({ mode: mode as TimelineMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.timeline, 'TIMELINE', 'Línea de tiempo generada.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar la línea de tiempo.'),
        });
      return;
    }

    if (composerMode === 'lessons-learned') {
      this.http.generateLessonsLearned({ mode: mode as LessonsLearnedMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.lessons_learned, 'LESSONS_LEARNED', 'Lecciones aprendidas generadas.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar las lecciones aprendidas.'),
        });
      return;
    }

    if (composerMode === 'decision-brief') {
      this.http.generateDecisionBrief({ mode: mode as DecisionBriefMode, message, chat_id: chatId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => onSuccess(res.decision_brief, 'DECISION_BRIEF', 'Brief de decisión generado.', res.fragments as unknown as ChatFragment[]),
          error: () => onError('No se pudo generar el brief de decisión.'),
        });
      return;
    }

    if (composerMode === 'document-summary') {
      const docIds = this.sessionDocuments().map((d) => d.id);
      if (docIds.length === 0) { onError('Subí al menos un documento antes de generar un resumen.'); return; }
      this.http.generateDocumentSummary({ document_ids: docIds, chat_id: chatId! })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.sessionDocuments.set([]);
            onSuccess(res.document_summary as unknown as { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string; mode: string }, 'DOCUMENT_SUMMARY', 'Resumen generado.', res.fragments as unknown as ChatFragment[]);
          },
          error: () => onError('No se pudo generar el resumen.'),
        });
      return;
    }

    if (composerMode === 'document-action') {
      const docIds = this.sessionDocuments().map((d) => d.id);
      if (docIds.length === 0) { onError('Subí al menos un documento antes de generar la acción.'); return; }
      const actionType = this.genDocumentActionType();
      this.http.generateDocumentAction({
        document_ids: docIds,
        instruction: message,
        action: actionType || null,
        chat_id: chatId!,
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.sessionDocuments.set([]);
            onSuccess(res.document_action as unknown as { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string; mode: string }, 'DOCUMENT_ACTION', 'Acción generada.', res.fragments as unknown as ChatFragment[]);
          },
          error: () => onError('No se pudo generar la acción.'),
        });
      return;
    }

    // report (default)
    this.http.generateReport({ type: this.genReportType(), mode: mode as ReportMode, message, chat_id: chatId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => onSuccess(res.report, 'REPORT', 'Informe generado.', res.fragments as unknown as ChatFragment[]),
        error: () => onError('No se pudo generar el informe.'),
      });
  }

  private _pushGeneratedArtifact(
    resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string; mode: string },
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
        artifactMode: resource.mode as ArtifactMode,
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

  private _startDocumentPolling(docId: number): void {
    this._stopDocumentPolling(docId);
    const stop$ = new Subject<void>();
    this._docPolls.set(docId, stop$);

    timer(1500, 2500).pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(stop$),
      switchMap(() => this.documents.getDocument(docId)),
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

  // ── Voice recording ──────────────────────────────────────────
  async startRecording(): Promise<void> {
    if (this.voiceState() !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };
      this._mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this._sendAudio(new Blob(this._audioChunks, { type: mimeType }));
      };

      this._mediaRecorder.start(200);
      this.voiceState.set('recording');
      this.recordingSeconds.set(0);
      this._recordingTimer = setInterval(() => {
        this.recordingSeconds.update((s) => s + 1);
        if (this.recordingSeconds() >= 120) this.stopRecording();
      }, 1000);
    } catch {
      this.toast.show('No se pudo acceder al micrófono.', 'error');
    }
  }

  stopRecording(): void {
    if (this.voiceState() !== 'recording') return;
    if (this._recordingTimer != null) {
      clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }
    this._mediaRecorder?.stop();
    this.voiceState.set('processing');
  }

  cancelRecording(): void {
    if (this._recordingTimer != null) {
      clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.onstop = null;
      this._mediaRecorder.stop();
      this._mediaRecorder.stream?.getTracks().forEach((t) => t.stop());
    }
    this._mediaRecorder = null;
    this._audioChunks = [];
    this.voiceState.set('idle');
    this.recordingSeconds.set(0);
  }

  private _sendAudio(blob: Blob): void {
    const chatId = this.chatId;
    if (!chatId) { this.voiceState.set('idle'); return; }

    const mode = this.composerMode();
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    const done = () => { this.voiceState.set('idle'); this.recordingSeconds.set(0); };

    const voiceSuccess = (
      resource: { id: number; title: string; source_chat_id: number | null; created_by: number; created_at: string; mode: string },
      type: ArtifactType,
      toastMsg: string,
      fragments?: readonly ChatFragment[] | null,
    ) => {
      done();
      this.genMessage.set('');
      this.composerMode.set('chat');
      this._pushGeneratedArtifact(resource, type, fragments);
      this.toast.show(toastMsg, 'success');
    };

    if (mode === 'report') {
      formData.append('type', this.genReportType());
      formData.append('mode', this.genMode());
      formData.append('chat_id', String(chatId));
      this.http.generateReport(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.report, 'REPORT', 'Informe generado.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar el informe.', 'error'); },
        });
      return;
    }

    if (mode === 'checklist') {
      formData.append('mode', this.genMode());
      formData.append('chat_id', String(chatId));
      this.http.generateChecklist(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.checklist, 'CHECKLIST', 'Checklist generada.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar la checklist.', 'error'); },
        });
      return;
    }

    if (mode === 'quiz') {
      formData.append('mode', this.genMode());
      formData.append('chat_id', String(chatId));
      this.http.generateQuiz(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.quiz, 'QUIZ', 'Quiz generado.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar el quiz.', 'error'); },
        });
      return;
    }

    if (mode === 'timeline') {
      formData.append('mode', this.genMode());
      formData.append('chat_id', String(chatId));
      this.http.generateTimeline(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.timeline, 'TIMELINE', 'Línea de tiempo generada.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar la línea de tiempo.', 'error'); },
        });
      return;
    }

    if (mode === 'lessons-learned') {
      formData.append('mode', this.genMode());
      formData.append('chat_id', String(chatId));
      this.http.generateLessonsLearned(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => voiceSuccess(res.lessons_learned, 'LESSONS_LEARNED', 'Lecciones aprendidas generadas.', res.fragments as unknown as ChatFragment[]),
          error: () => { done(); this.toast.show('No se pudo generar las lecciones aprendidas.', 'error'); },
        });
      return;
    }

    if (mode === 'decision-brief') {
      formData.append('mode', this.genMode());
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
          this.socket.sendUserMessage(text, this.aiMode());
        },
        error: () => { done(); this.toast.show('No se pudo transcribir el audio.', 'error'); },
      });
  }

  get recordingLabel(): string {
    const s = this.recordingSeconds();
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  ngOnDestroy(): void {
    this.cancelRecording();
    this.teardownSocket();
    this.clearDeltaScheduling();
    this.chatShell.clearCurrentChat();
    this._messagesTopObserver?.disconnect();
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

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.chat || this.sendBlocked()) return;

    const text = this.newMessage.trim();
    this.newMessage = '';
    queueMicrotask(() => this.autosizeTextarea());

    const docIds = this.sessionDocuments().map((d) => d.id);
    if (docIds.length > 0) this.sessionDocuments.set([]);

    if (this.socket) {
      this.socket.sendUserMessage(text, this.aiMode(), docIds.length > 0 ? docIds : undefined);
      setTimeout(() => this.scrollToBottom(), 50);
      return;
    }

    if (!this.chatId) return;
    this.isTyping.set(true);
    this.http
      .sendMessageJson(this.chatId, { chat_id: this.chatId!, message: text, mode: this.aiMode() })
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

  threadReplyAvatarColor(userId: number): string {
    const palette = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    return palette[userId % palette.length];
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

  artifactStatusLabel(status: string | null | undefined): string {
    switch (status) {
      case 'draft':    return 'Borrador';
      case 'final':    return 'Final';
      case 'archived': return 'Archivado';
      default:         return status ?? '';
    }
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
    return this.aiModes.some((m) => m.value === raw) ? (raw as AuraChatAiMode) : undefined;
  }

  private consumePendingGenerationFromHistory(): {
    mode: 'report' | 'checklist' | 'quiz' | 'timeline' | 'lessons-learned' | 'decision-brief' | 'document-summary' | 'document-action';
    type?: ReportType;
    genMode: 'direct' | 'rag';
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
    return {
      mode: g['mode'] as typeof validModes[number],
      type: g['type'] as ReportType | undefined,
      genMode: (g['genMode'] === 'rag' ? 'rag' : 'direct'),
      message: String(g['message'] ?? ''),
    };
  }

  private async openWebSocketAfterLoad(expectedChatId: number, sessionId: number, pending?: string): Promise<void> {
    if (this.chatId !== expectedChatId || this.wsSessionId !== sessionId) return;
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
      conn.sendUserMessage(pending.trim(), this.aiMode());
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
          sender_type: msg.sender_type as MessageSenderType,
          created_by: msg.created_by,
          created_at: msg.created_at,
          is_bookmarked: false,
          user_feedback: null,
          thread_reply_count: 0,
          artifactType: 'MESSAGE',
        };
        this.messages.update((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
        if (row.created_by != null) this._resolveMessageUsers([row]);
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
        const aiSenderType: MessageSenderType = (msg.sender_type as MessageSenderType | undefined) ?? 'assistant';
        if (sid != null && msg.id != null) {
          this.messages.update((list) =>
            list.map((m) =>
              m.id === sid
                ? {
                    id: msg.id!,
                    chat_id: cid,
                    message: text,
                    sender_type: aiSenderType,
                    created_by: msg.created_by ?? null,
                    created_at: msg.created_at ?? new Date().toISOString(),
                    is_bookmarked: false,
                    user_feedback: null,
                    thread_reply_count: 0,
                    artifactType: 'MESSAGE' as ArtifactType,
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
              sender_type: aiSenderType,
              created_by: msg.created_by ?? null,
              created_at: msg.created_at ?? new Date().toISOString(),
              is_bookmarked: false,
              user_feedback: null,
              thread_reply_count: 0,
              artifactType: 'MESSAGE' as ArtifactType,
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
      case 'chat_ai_lock':
        if (msg.locked) {
          this.isTyping.set(true);
        } else {
          // Lock released without an ai_complete — clear processing indicators.
          if (this.streamingAssistantId() === null) {
            this.isTyping.set(false);
            this.aiProgressStep.set(null);
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
