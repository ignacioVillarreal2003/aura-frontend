import {
  Component,
  ElementRef,
  type OnDestroy,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@core/components/toast-service';
import type {
  AuraChatAiMode,
  DocumentActionType,
  ReportType,
} from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_AI_MODE_DEFAULT } from '@aura-types/aura-chat-service.types';

export type ComposerToolMode =
  | 'report'
  | 'checklist'
  | 'quiz'
  | 'timeline'
  | 'lessons-learned'
  | 'decision-brief'
  | 'document-summary'
  | 'document-action';

export type ComposerMode = 'chat' | ComposerToolMode;

/** Unified attachment chip shape, regardless of how the host stores files. */
export interface ComposerDoc {
  readonly id: number | string;
  readonly name: string;
  readonly status: 'ready' | 'processing' | 'failed';
}

export interface ComposerChatSubmit {
  readonly text: string;
  readonly aiMode: AuraChatAiMode;
}

export interface ComposerGenerate {
  readonly mode: ComposerToolMode;
  readonly genMode: 'direct' | 'rag';
  readonly reportType: ReportType;
  readonly documentActionType: DocumentActionType | '';
  readonly message: string;
}

/** Captured audio plus the composer context the host needs to route it. */
export interface ComposerAudio {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly mode: ComposerMode;
  readonly genMode: 'direct' | 'rag';
  readonly reportType: ReportType;
  readonly aiMode: AuraChatAiMode;
}

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
];

const REPORT_TYPES: readonly { value: ReportType; label: string; placeholder: string }[] = [
  { value: 'SITREP', label: 'SITREP — Situación', placeholder: 'Describí la situación, unidades involucradas, área de operaciones…' },
  { value: 'INTSUM', label: 'INTSUM — Inteligencia', placeholder: 'Describí la amenaza, período cubierto, eventos relevantes…' },
  { value: 'OPORD', label: 'OPORD — Operaciones', placeholder: 'Describí la misión, situación, plan de ejecución…' },
];

/**
 * Presentational composer shared by chat-home and chat-session.
 *
 * It owns the input UI + ephemeral state (text, mode, gen controls, voice
 * recording mechanics) and emits intent through outputs. The host decides what
 * to do with each intent (create+navigate, send over WS, generate inline, …).
 */
@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-composer.html',
  styleUrls: ['./chat-composer.css'],
})
export class ChatComposer implements OnDestroy {
  private readonly toast = inject(ToastService);

  // ── Inputs ─────────────────────────────────────────────────────
  readonly perms = input<readonly string[]>([]);
  readonly voiceEnabled = input(false);
  /** Generation/submission in flight: disables controls + shows spinner. */
  readonly busy = input(false);
  /** Host-specific block on chat send (e.g. streaming/typing/uploading). */
  readonly sendDisabled = input(false);
  readonly attachedDocs = input<readonly ComposerDoc[]>([]);
  readonly hasDocs = input(false);
  readonly docsReady = input(true);
  /** Allow chat send with no text when documents are attached (home only). */
  readonly allowEmptyTextWithDocs = input(false);
  readonly chatPlaceholder = input('Escribí un mensaje…');

  // ── Two-way model ──────────────────────────────────────────────
  readonly text = model('');

  // ── Outputs ────────────────────────────────────────────────────
  readonly submitChat = output<ComposerChatSubmit>();
  readonly generate = output<ComposerGenerate>();
  readonly filesSelected = output<File[]>();
  readonly removeDoc = output<ComposerDoc>();
  readonly audioCaptured = output<ComposerAudio>();
  readonly typing = output<void>();
  readonly composerModeChange = output<ComposerMode>();

  // ── Static config ──────────────────────────────────────────────
  readonly reportTypes = REPORT_TYPES;

  // ── Composer state ─────────────────────────────────────────────
  readonly composerMode = signal<ComposerMode>('chat');
  readonly genMessage = signal('');
  readonly genMode = signal<'direct' | 'rag'>('direct');
  readonly genReportType = signal<ReportType>('SITREP');
  readonly genDocumentActionType = signal<DocumentActionType | ''>('');
  readonly modeDropdownOpen = signal(false);

  // ── AI chat mode ───────────────────────────────────────────────
  readonly aiMode = signal<AuraChatAiMode>(AURA_CHAT_AI_MODE_DEFAULT);
  readonly aiModeDropdownOpen = signal(false);
  readonly availableAiModes = computed(() => {
    const perms = this.perms();
    return AI_MODES.filter((m) => m.permission === null || perms.includes(m.permission));
  });
  readonly showAiModeSelector = computed(() => this.availableAiModes().length > 1);
  readonly activeAiMode = computed(
    () => AI_MODES.find((m) => m.value === this.aiMode()) ?? AI_MODES[0],
  );

  // ── Tool permissions ───────────────────────────────────────────
  readonly canReport          = computed(() => this.perms().includes('LLM_REPORT_GENERATE'));
  readonly canChecklist       = computed(() => this.perms().includes('LLM_CHECKLIST_GENERATE'));
  readonly canQuiz            = computed(() => this.perms().includes('LLM_QUIZ_GENERATE'));
  readonly canTimeline        = computed(() => this.perms().includes('LLM_TIMELINE_GENERATE'));
  readonly canLessonsLearned  = computed(() => this.perms().includes('LLM_LESSONS_LEARNED_GENERATE'));
  readonly canDecisionBrief   = computed(() => this.perms().includes('LLM_DECISION_BRIEF_GENERATE'));
  readonly canDocumentSummary = computed(() => this.perms().includes('LLM_DOCUMENT_SUMMARY_GENERATE'));
  readonly canDocumentAction  = computed(() => this.perms().includes('LLM_DOCUMENT_ACTION_GENERATE'));
  readonly canUseTools = computed(() =>
    this.canReport() || this.canChecklist() || this.canQuiz() ||
    this.canTimeline() || this.canLessonsLearned() || this.canDecisionBrief() ||
    this.canDocumentSummary() || this.canDocumentAction(),
  );

  // ── Voice recording ────────────────────────────────────────────
  readonly voiceState = signal<'idle' | 'recording' | 'processing'>('idle');
  readonly recordingSeconds = signal(0);
  private _mediaRecorder: MediaRecorder | null = null;
  private _audioChunks: Blob[] = [];
  private _recordingTimer: ReturnType<typeof setInterval> | null = null;
  private _recordingMimeType = 'audio/webm';

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  // ── Derived labels ─────────────────────────────────────────────
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
    this.attachedDocs().some((d) => d.status === 'processing'),
  );

  /** Whether the primary action button is enabled. */
  readonly canSubmit = computed(() => {
    if (this.busy() || this.voiceState() !== 'idle') return false;
    const mode = this.composerMode();
    if (mode === 'chat') {
      if (this.sendDisabled()) return false;
      return this.text().trim().length > 0 || (this.allowEmptyTextWithDocs() && this.hasDocs());
    }
    if (mode === 'document-summary') return this.hasDocs() && this.docsReady();
    if (mode === 'document-action') return this.hasDocs() && this.docsReady() && this.genMessage().trim().length > 0;
    return this.genMessage().trim().length > 0;
  });

  readonly voiceDisabled = computed(() =>
    this.sendDisabled() || (this.composerMode() !== 'chat' && this.busy()),
  );

  readonly sendIcon = computed(() => {
    if (this.busy()) return 'pi-spin pi-spinner';
    return this.composerMode() === 'chat' ? 'pi-send' : 'pi-sparkles';
  });

  // ── Mode handling ──────────────────────────────────────────────
  toggleModeDropdown(): void {
    this.modeDropdownOpen.update((v) => !v);
  }

  setComposerMode(mode: ComposerMode): void {
    this.composerMode.set(mode);
    this.genMessage.set('');
    this.genMode.set('direct');
    this.genDocumentActionType.set('');
    this.modeDropdownOpen.set(false);
    this.composerModeChange.emit(mode);
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

  /** Host preset (e.g. carrying the AI mode from the home screen). No focus side effect. */
  presetAiMode(mode: AuraChatAiMode): void {
    this.aiMode.set(mode);
  }

  /** Lets the host preset/reset state (e.g. consuming a pending generation). */
  resetToChat(): void {
    this.composerMode.set('chat');
    this.genMessage.set('');
    this.genMode.set('direct');
    this.genDocumentActionType.set('');
    this.modeDropdownOpen.set(false);
    this.aiModeDropdownOpen.set(false);
  }

  // ── Text input ─────────────────────────────────────────────────
  onMessageInput(value: string): void {
    this.text.set(value);
    queueMicrotask(() => this.autosizeTextarea());
    this.typing.emit();
  }

  private autosizeTextarea(): void {
    const el = this.messageBox()?.nativeElement;
    if (!el) return;
    const styles = getComputedStyle(el);
    const maxHeight = parseFloat(styles.maxHeight);
    const maxPx = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    el.style.height = `${Math.min(scrollH, maxPx)}px`;
    el.style.overflowY = scrollH > maxPx ? 'auto' : 'hidden';
  }

  onChatEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onPrimaryAction();
    }
  }

  onGenEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.onPrimaryAction();
    }
  }

  // ── Files ──────────────────────────────────────────────────────
  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 0) this.filesSelected.emit(files);
  }

  onRemoveDoc(doc: ComposerDoc): void {
    this.removeDoc.emit(doc);
  }

  // ── Primary action (send / generate) ───────────────────────────
  onPrimaryAction(): void {
    if (!this.canSubmit()) return;
    if (this.composerMode() === 'chat') {
      this.submitChat.emit({ text: this.text().trim(), aiMode: this.aiMode() });
      return;
    }
    this.generate.emit({
      mode: this.composerMode() as ComposerToolMode,
      genMode: this.genMode(),
      reportType: this.genReportType(),
      documentActionType: this.genDocumentActionType(),
      message: this.genMessage().trim(),
    });
  }

  /** Clears the chat textarea (host calls after a successful send). */
  clearText(): void {
    this.text.set('');
    queueMicrotask(() => this.autosizeTextarea());
  }

  // ── Voice recording ────────────────────────────────────────────
  async startRecording(): Promise<void> {
    if (this.voiceState() !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      this._recordingMimeType = mimeType;
      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };
      this._mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.emitAudio(new Blob(this._audioChunks, { type: mimeType }));
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

  /** Host calls this once it finished processing the captured audio. */
  finishVoiceProcessing(): void {
    this.voiceState.set('idle');
    this.recordingSeconds.set(0);
  }

  private emitAudio(blob: Blob): void {
    this.audioCaptured.emit({
      blob,
      mimeType: this._recordingMimeType,
      mode: this.composerMode(),
      genMode: this.genMode(),
      reportType: this.genReportType(),
      aiMode: this.aiMode(),
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
  }
}
