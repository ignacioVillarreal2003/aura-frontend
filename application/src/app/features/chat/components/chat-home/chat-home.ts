import { Component, DestroyRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, map, of, shareReplay, switchMap, takeUntil, throwError, timer } from 'rxjs';
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

/** Documento adjunto en la pantalla de inicio: ya subido al chat y en proceso. */
interface SessionDocument {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, ChatComposer],
  templateUrl: './chat-home.html',
  styleUrls: ['./chat-home.css'],
})
export class ChatHome implements OnDestroy {
  private readonly router    = inject(Router);
  private readonly api       = inject(AuraChatServiceHttp);
  private readonly docHttp   = inject(AuraDocumentProcessingServiceHttp);
  private readonly toast     = inject(ToastService);
  private readonly userState = inject(UserState);
  private readonly handoff   = inject(ChatComposerHandoffService);
  private readonly destroyRef = inject(DestroyRef);

  readonly perms = computed(() => this.userState.user()?.permissions ?? []);

  readonly submitting   = signal(false);
  readonly composerMode = signal<ComposerMode>('chat');

  /**
   * El chat se crea de forma perezosa: apenas adjuntás un documento (para tener
   * un id contra el cual subirlo y procesarlo), o al enviar el primer mensaje si
   * no adjuntaste nada. Una vez creado se reutiliza el mismo id.
   */
  private readonly chatId = signal<number | null>(null);
  private chatCreate$: Observable<number> | null = null;

  /** Documentos ya subidos al chat nuevo; se procesan con polling, igual que en sesión. */
  readonly sessionDocuments = signal<SessionDocument[]>([]);
  private readonly uploadingCount = signal(0);
  readonly documentUploading = computed(() => this.uploadingCount() > 0);
  private readonly _docPolls = new Map<number, Subject<void>>();

  /** Chips para el composer, con el estado real de procesamiento. */
  readonly attachedDocs = computed<ComposerDoc[]>(() =>
    this.sessionDocuments().map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status === 'processed' ? 'ready' : d.status === 'failed' ? 'failed' : 'processing',
    })),
  );
  readonly hasDocs = computed(() => this.sessionDocuments().length > 0);
  readonly allDocsReady = computed(() => this.sessionDocuments().every((d) => d.status === 'processed'));
  /** Bloquea el envío mientras se sube o procesa algún documento (estado `uploaded`). */
  readonly sendBlocked = computed(() =>
    this.documentUploading() || this.sessionDocuments().some((d) => d.status === 'uploaded'),
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

  // ── Chat perezoso ──────────────────────────────────────────────
  /** Devuelve el id del chat, creándolo una sola vez si hace falta. */
  private ensureChat(preferredName: string): Observable<number> {
    const id = this.chatId();
    if (id != null) return of(id);
    if (!this.chatCreate$) {
      const name = preferredName.slice(0, 80).replace(/\s+/g, ' ').trim() || 'Nuevo chat';
      this.chatCreate$ = this.api.createChat({ name }).pipe(
        map((chat) => {
          this.chatId.set(chat.id);
          return chat.id;
        }),
        catchError((err) => {
          this.chatCreate$ = null;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.chatCreate$;
  }

  // ── Files ──────────────────────────────────────────────────────
  onFilesSelected(files: File[]): void {
    const existingNames = new Set(this.sessionDocuments().map((d) => d.name));
    const fresh = files.filter((f) => !existingNames.has(f.name));
    if (fresh.length === 0) return;
    // Creá el chat (si no existe) y subí cada archivo contra su id, arrancando el
    // procesamiento de inmediato — como cuando adjuntás dentro de un chat.
    this.ensureChat(fresh[0].name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (chatId) => fresh.forEach((file) => this.uploadDocument(file, chatId)),
      error: () => this.toast.show('No se pudo crear el chat para subir el documento.', 'error'),
    });
  }

  onRemoveDoc(doc: ComposerDoc): void {
    const id = Number(doc.id);
    if (!Number.isFinite(id)) return;
    this.stopDocumentPolling(id);
    this.sessionDocuments.update((docs) => docs.filter((d) => d.id !== id));
    this.docHttp.deleteDocument(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.toast.show('No se pudo eliminar el documento del servidor.', 'error'),
    });
  }

  private uploadDocument(file: File, chatId: number): void {
    this.uploadingCount.update((n) => n + 1);
    let upload$;
    try {
      upload$ = this.docHttp.createDocumentFromInput({ file, chat_id: chatId, prefer_docling: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Archivo inválido.';
      this.toast.show(msg, 'error');
      this.uploadingCount.update((n) => Math.max(0, n - 1));
      return;
    }
    upload$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sessionDocuments.update((d) => [
          ...d,
          { id: res.id, name: res.name, status: res.status, created_at: new Date().toISOString() },
        ]);
        this.uploadingCount.update((n) => Math.max(0, n - 1));
        this.startDocumentPolling(res.id);
      },
      error: () => {
        this.toast.show('Error al subir el documento.', 'error');
        this.uploadingCount.update((n) => Math.max(0, n - 1));
      },
    });
  }

  private startDocumentPolling(docId: number): void {
    this.stopDocumentPolling(docId);
    const stop$ = new Subject<void>();
    this._docPolls.set(docId, stop$);

    timer(1500, 2500).pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(stop$),
      switchMap(() => this.docHttp.getDocumentStatus(docId)),
    ).subscribe({
      next: (doc) => {
        this.sessionDocuments.update((docs) =>
          docs.map((d) => (d.id === docId ? { ...d, status: doc.status } : d)),
        );
        if (doc.status === 'processed' || doc.status === 'failed') {
          this.stopDocumentPolling(docId);
          if (doc.status === 'failed') this.toast.show('Error al procesar el documento.', 'error');
        }
      },
      error: () => this.stopDocumentPolling(docId),
    });
  }

  private stopDocumentPolling(docId: number): void {
    const stop$ = this._docPolls.get(docId);
    if (stop$) { stop$.next(); stop$.complete(); this._docPolls.delete(docId); }
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
    this.finalizeAndNavigate(payload.text, routerState);
  }

  onGenerate(payload: ComposerGenerate): void {
    const gen: PendingGeneration = {
      mode: payload.mode,
      retrieveContext: payload.retrieveContext,
      processDocuments: payload.processDocuments,
      message: payload.message,
      ...(payload.mode === 'report' ? { type: payload.reportType } : {}),
    };
    this.finalizeAndNavigate(payload.message, { pendingGeneration: gen });
  }

  onAudioCaptured(audio: ComposerAudio): void {
    // Mismo modelo: asegurá el chat y dejá que la sesión procese la grabación
    // exactamente como una hecha dentro del chat.
    this.handoff.setPendingAudio(audio);
    this.finalizeAndNavigate('', {});
  }

  /**
   * Asegura el chat (creándolo si todavía no existe) y navega a la sesión,
   * sembrando los documentos ya subidos para que el primer mensaje/artefacto los
   * adjunte. El chat suele estar creado de antes si adjuntaste un documento.
   */
  private finalizeAndNavigate(seed: string, routerState: Record<string, unknown>): void {
    this.submitting.set(true);
    const nameHint = seed || this.sessionDocuments()[0]?.name || 'Nuevo chat';
    this.ensureChat(nameHint).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (chatId) => {
        this.submitting.set(false);
        const docs: PendingDocument[] = this.sessionDocuments().map((d) => ({
          id: d.id, name: d.name, status: d.status,
        }));
        // La sesión retoma el polling de los que sigan en proceso.
        this.sessionDocuments().forEach((d) => this.stopDocumentPolling(d.id));
        this.sessionDocuments.set([]);
        const state = docs.length > 0 ? { ...routerState, pendingDocuments: docs } : routerState;
        void this.router.navigate(
          ['/main-container', 'chat', String(chatId)],
          Object.keys(state).length > 0 ? { state } : {},
        );
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show('No se pudo crear el chat.', 'error');
      },
    });
  }

  ngOnDestroy(): void {
    this._docPolls.forEach((s) => { s.next(); s.complete(); });
    this._docPolls.clear();
  }
}
