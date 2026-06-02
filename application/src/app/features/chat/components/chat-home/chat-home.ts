import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { UserState } from '@core/state/user.state';
import type { AuraChatAiMode, ReportType } from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_AI_MODE_DEFAULT } from '@aura-types/aura-chat-service.types';

interface PendingGeneration {
  mode: 'report' | 'checklist';
  type?: ReportType;
  genMode: 'direct' | 'rag';
  message: string;
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
  { value: 'agent', label: 'Agente', icon: 'pi-bolt', hint: 'Agente con herramientas sobre documentos.', permission: 'LLM_AGENT' },
];


const REPORT_TYPES: readonly { value: ReportType; label: string; placeholder: string }[] = [
  { value: 'SITREP', label: 'SITREP — Situación', placeholder: 'Describí la situación, unidades involucradas, área de operaciones…' },
  { value: 'INTSUM', label: 'INTSUM — Inteligencia', placeholder: 'Describí la amenaza, período cubierto, eventos relevantes…' },
  { value: 'OPORD',  label: 'OPORD — Operaciones',  placeholder: 'Describí la misión, situación, plan de ejecución…' },
];

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-home.html',
  styleUrls: ['./chat-home.css'],
})
export class ChatHomeComponent {
  private readonly router   = inject(Router);
  private readonly api      = inject(AuraChatServiceHttp);
  private readonly docHttp  = inject(AuraDocumentProcessingServiceHttp);
  private readonly toast    = inject(ToastService);
  private readonly userState = inject(UserState);

  readonly reportTypes = REPORT_TYPES;

  // ── Permissions ────────────────────────────────────────────────
  readonly canReport    = computed(() => this.userState.user()?.permissions.includes('LLM_REPORT_GENERATE') ?? false);
  readonly canChecklist = computed(() => this.userState.user()?.permissions.includes('LLM_CHECKLIST_GENERATE') ?? false);
  readonly canUseTools  = computed(() => this.canReport() || this.canChecklist());

  // ── Composer state ─────────────────────────────────────────────
  readonly composerMode     = signal<'chat' | 'report' | 'checklist'>('chat');

  // ── AI chat mode (document_question / general_chat / rag_agent / agent) ──
  readonly aiModes          = AI_MODES;
  readonly aiMode           = signal<AuraChatAiMode>(AURA_CHAT_AI_MODE_DEFAULT);
  readonly aiModeDropdownOpen = signal(false);
  readonly availableAiModes = computed(() => {
    const perms = this.userState.user()?.permissions ?? [];
    return AI_MODES.filter((m) => m.permission === null || perms.includes(m.permission));
  });
  readonly showAiModeSelector = computed(() => this.availableAiModes().length > 1);
  readonly activeAiMode = computed(
    () => AI_MODES.find((m) => m.value === this.aiMode()) ?? AI_MODES[0],
  );

  readonly genReportType    = signal<ReportType>('SITREP');
  readonly genMode          = signal<'direct' | 'rag'>('direct');
  readonly genMessage       = signal('');
  readonly modeDropdownOpen = signal(false);
  readonly message          = signal('');
  readonly submitting       = signal(false);
  readonly pendingFiles     = signal<File[]>([]);

  readonly composerModeLabel = computed(() => {
    switch (this.composerMode()) {
      case 'report':    return { icon: 'pi-file-edit',    label: 'Informe' };
      case 'checklist': return { icon: 'pi-check-square', label: 'Checklist' };
      default:          return { icon: 'pi-comments',     label: 'Chat' };
    }
  });

  readonly genPlaceholder = computed(() => {
    if (this.composerMode() === 'checklist') return 'Describí el procedimiento o SOP a convertir en checklist…';
    return REPORT_TYPES.find((t) => t.value === this.genReportType())?.placeholder ?? 'Ingresá el contenido…';
  });

  readonly canSend = computed(() => {
    if (this.submitting()) return false;
    if (this.composerMode() === 'chat') return this.message().trim().length > 0 || this.pendingFiles().length > 0;
    return this.genMessage().trim().length > 0;
  });

  readonly sendIcon = computed(() => {
    if (this.submitting()) return 'pi-spin pi-spinner';
    return this.composerMode() === 'chat' ? 'pi-send' : 'pi-sparkles';
  });

  readonly sendLabel = computed(() =>
    this.composerMode() === 'chat' ? 'Enviar' : 'Crear y generar'
  );

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  // ── Mode methods ───────────────────────────────────────────────
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

  toggleAiModeDropdown(): void {
    this.aiModeDropdownOpen.update((v) => !v);
  }

  setAiMode(mode: AuraChatAiMode): void {
    this.aiMode.set(mode);
    this.aiModeDropdownOpen.set(false);
    setTimeout(() => this.messageBox()?.nativeElement.focus(), 50);
  }

  // ── Message / files ────────────────────────────────────────────
  onMessageInput(value: string): void {
    this.message.set(value);
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
    el.style.height = `${Math.min(scrollH, maxPx)}px`;
    el.style.overflowY = scrollH > maxPx ? 'auto' : 'hidden';
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    input.value = '';
    if (selected.length === 0) return;
    this.pendingFiles.update((current) => {
      const existingNames = new Set(current.map((f) => f.name));
      return [...current, ...selected.filter((f) => !existingNames.has(f.name))];
    });
  }

  removeFile(file: File): void {
    this.pendingFiles.update((list) => list.filter((f) => f !== file));
  }

  // ── Send ───────────────────────────────────────────────────────
  onSend(): void {
    if (!this.canSend()) return;

    const mode  = this.composerMode();
    const files = this.pendingFiles();

    const text = mode === 'chat'
      ? this.message().trim()
      : this.genMessage().trim();

    const chatName = text.slice(0, 80).replace(/\s+/g, ' ').trim()
      || files[0]?.name.replace(/\.[^.]+$/, '').slice(0, 80)
      || 'Nuevo chat';

    this.submitting.set(true);

    this.api.createChat({ name: chatName }).pipe(
      switchMap((chat) => {
        if (files.length === 0) return of(chat);
        const uploads = files.map((file) => {
          try {
            return this.docHttp.createDocumentFromInput({
              file, chat_id: chat.id, prefer_docling: false,
            }).pipe(catchError(() => of(null)));
          } catch {
            return of(null);
          }
        });
        return forkJoin(uploads).pipe(map(() => chat));
      }),
    ).subscribe({
      next: (chat) => {
        this.submitting.set(false);
        this.message.set('');
        this.genMessage.set('');
        this.pendingFiles.set([]);
        queueMicrotask(() => this.autosizeTextarea());

        const routerState: Record<string, unknown> = {};

        if (mode === 'chat' && text) {
          routerState['pendingMessage'] = text;
          if (this.aiMode() !== AURA_CHAT_AI_MODE_DEFAULT) {
            routerState['pendingAiMode'] = this.aiMode();
          }
        } else if (mode === 'report' || mode === 'checklist') {
          const gen: PendingGeneration = {
            mode,
            genMode: this.genMode(),
            message: text,
            ...(mode === 'report' ? { type: this.genReportType() } : {}),
          };
          routerState['pendingGeneration'] = gen;
        }

        void this.router.navigate(
          ['/main-container', 'chat', String(chat.id)],
          Object.keys(routerState).length > 0 ? { state: routerState } : {},
        );
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show('No se pudo crear el chat.', 'error');
      },
    });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onGenEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.onSend();
    }
  }
}
