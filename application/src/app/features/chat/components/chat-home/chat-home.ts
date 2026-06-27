import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { UserState } from '@core/state/user.state';
import type { ReportType } from '@aura-types/aura-chat-service.types';
import { AURA_CHAT_AI_MODE_DEFAULT } from '@aura-types/aura-chat-service.types';
import {
  ChatComposer,
  type ComposerAudio,
  type ComposerChatSubmit,
  type ComposerDoc,
  type ComposerGenerate,
  type ComposerMode,
} from '../chat-composer/chat-composer';
import { ChatComposerHandoffService } from '../chat-composer/chat-composer-handoff.service';

interface PendingGeneration {
  mode: Exclude<ComposerMode, 'chat'>;
  type?: ReportType;
  retrieveContext: boolean | null;
  processDocuments: boolean | null;
  message: string;
}

interface PendingDocument {
  id: number;
  name: string;
  status: string;
}

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, ChatComposer],
  templateUrl: './chat-home.html',
  styleUrls: ['./chat-home.css'],
})
export class ChatHome {
  private readonly router    = inject(Router);
  private readonly api       = inject(AuraChatServiceHttp);
  private readonly docHttp   = inject(AuraDocumentProcessingServiceHttp);
  private readonly toast     = inject(ToastService);
  private readonly userState = inject(UserState);
  private readonly handoff   = inject(ChatComposerHandoffService);

  readonly perms = computed(() => this.userState.user()?.permissions ?? []);

  readonly submitting   = signal(false);
  readonly pendingFiles = signal<File[]>([]);
  readonly composerMode = signal<ComposerMode>('chat');

  /** Unified chips for the composer. Local files are always "ready". */
  readonly attachedDocs = computed<ComposerDoc[]>(() =>
    this.pendingFiles().map((f) => ({ id: f.name, name: f.name, status: 'ready' as const })),
  );

  readonly welcomeSubtitle = computed(() => {
    switch (this.composerMode()) {
      case 'report':           return 'Describí el contexto y el tipo de informe a generar.';
      case 'checklist':        return 'Describí el procedimiento o SOP a convertir en checklist.';
      case 'quiz':             return 'Describí el tema para generar preguntas de evaluación.';
      case 'timeline':         return 'Describí la secuencia de eventos para construir la cronología.';
      case 'lessons-learned':  return 'Describí la actividad cuyos aprendizajes querés registrar.';
      case 'decision-brief':   return 'Describí el problema y las alternativas para el análisis.';
      case 'document-summary': return 'Adjuntá documentos con el botón + para generar el resumen.';
      case 'document-action':  return 'Adjuntá documentos y describí la tarea a ejecutar sobre ellos.';
      default:                 return 'Escribí una pregunta o subí un documento para empezar.';
    }
  });

  // ── Files ──────────────────────────────────────────────────────
  onFilesSelected(files: File[]): void {
    this.pendingFiles.update((current) => {
      const existingNames = new Set(current.map((f) => f.name));
      return [...current, ...files.filter((f) => !existingNames.has(f.name))];
    });
  }

  onRemoveDoc(doc: ComposerDoc): void {
    this.pendingFiles.update((list) => list.filter((f) => f.name !== doc.id));
  }

  // ── Submit handlers ────────────────────────────────────────────
  onSubmitChat(payload: ComposerChatSubmit): void {
    const routerState: Record<string, unknown> = {};
    if (payload.text) {
      routerState['pendingMessage'] = payload.text;
      if (payload.aiMode !== AURA_CHAT_AI_MODE_DEFAULT) {
        routerState['pendingAiMode'] = payload.aiMode;
      }
      if (payload.retrieveContext) routerState['pendingRetrieveContext'] = true;
      if (payload.processDocuments) routerState['pendingProcessDocuments'] = true;
    }
    this.createChatAndNavigate(payload.text, routerState);
  }

  onGenerate(payload: ComposerGenerate): void {
    const gen: PendingGeneration = {
      mode: payload.mode,
      retrieveContext: payload.retrieveContext,
      processDocuments: payload.processDocuments,
      message: payload.message,
      ...(payload.mode === 'report' ? { type: payload.reportType } : {}),
    };
    this.createChatAndNavigate(payload.message, { pendingGeneration: gen });
  }

  onAudioCaptured(audio: ComposerAudio): void {
    // Same model as everything else: create the chat first, then let the new
    // chat process the recording exactly like an in-session one.
    this.handoff.setPendingAudio(audio);
    this.createChatAndNavigate('', {});
  }

  private createChatAndNavigate(seed: string, routerState: Record<string, unknown>): void {
    const files = this.pendingFiles();
    const chatName = seed.slice(0, 80).replace(/\s+/g, ' ').trim()
      || files[0]?.name.replace(/\.[^.]+$/, '').slice(0, 80)
      || 'Nuevo chat';

    this.submitting.set(true);

    this.api.createChat({ name: chatName }).pipe(
      switchMap((chat) => {
        if (files.length === 0) return of({ chat, docs: [] as PendingDocument[] });
        const uploads = files.map((file) => {
          try {
            return this.docHttp.createDocumentFromInput({
              file, chat_id: chat.id, prefer_docling: false,
            }).pipe(catchError(() => of(null)));
          } catch {
            return of(null);
          }
        });
        return forkJoin(uploads).pipe(
          map((results) => ({
            chat,
            docs: results
              .filter((r): r is NonNullable<typeof r> => r != null)
              .map((r) => ({ id: r.id, name: r.name, status: r.status })),
          })),
        );
      }),
    ).subscribe({
      next: ({ chat, docs }) => {
        this.submitting.set(false);
        this.pendingFiles.set([]);
        // Pasá los documentos recién subidos a la sesión para que el primer
        // mensaje/artefacto los adjunte (sessionDocuments arranca vacío en la
        // sesión nueva, así que hay que sembrarlos vía el navigation state).
        const state = docs.length > 0 ? { ...routerState, pendingDocuments: docs } : routerState;
        void this.router.navigate(
          ['/main-container', 'chat', String(chat.id)],
          Object.keys(state).length > 0 ? { state } : {},
        );
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show('No se pudo crear el chat.', 'error');
      },
    });
  }
}
