import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, of, take } from 'rxjs';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatHttpService } from '@core/services/http/chat-http.service';
import { DocumentProcessingHttpService } from '@core/services/http/document-processing-http.service';
import { ToastService } from '@core/components/toast-service';
import type { CreateDocumentResponse, Document } from '@core/models/types/document.types';
import type { Chat, ChatMembership } from '@core/models/types/chat.types';

type PanelView = 'root' | 'documents' | 'participants' | 'chat';

@Component({
  selector: 'app-chat-options-drawer',
  standalone: true,
  imports: [CommonModule, BtnIcon],
  templateUrl: './chat-options-drawer.html',
  styleUrl: './chat-options-drawer.css',
  host: {
    '[class.open]': 'isOpen()',
  },
})
export class ChatOptionsDrawer {
  private readonly chatHttpService = inject(ChatHttpService);
  private readonly router = inject(Router);
  private readonly documentProcessingHttpService = inject(DocumentProcessingHttpService);
  private readonly toastService = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly isOpenChange = output<boolean>();
  readonly panelTitle = input<string>('Opciones del chat');

  readonly contextChat = input<Chat | null>(null);

  readonly attachedDocuments = input<readonly CreateDocumentResponse[]>([]);

  readonly uploadDisabled = input(false);

  readonly documentSelected = output<File>();
  readonly chatAction = output<{ chatId: number; action: string }>();
  readonly chatMetaUpdated = output<{ chatId: number; name: string }>();

  readonly panelView = signal<PanelView>('root');
  readonly members = signal<ChatMembership[]>([]);
  readonly membersLoading = signal(false);
  readonly serverDocuments = signal<Document[]>([]);
  readonly documentsLoading = signal(false);

  readonly headerTitle = computed(() => {
    switch (this.panelView()) {
      case 'chat':
        return 'Gestionar chat';
      case 'participants':
        return 'Participantes';
      case 'documents':
        return 'Documentos';
      default:
        return this.panelTitle();
    }
  });

  readonly contextChatId = computed(() => this.contextChat()?.id ?? null);
  readonly contextChatTitle = computed(() => this.contextChat()?.name ?? '');

  readonly mergedDocuments = computed((): Document[] => {
    const map = new Map<number, Document>();
    for (const d of this.serverDocuments()) {
      map.set(d.id, d);
    }
    for (const d of this.attachedDocuments()) {
      map.set(d.id, {
        id: d.id,
        chat_id: this.contextChatId(),
        name: d.name,
        description: null,
        mime_type: d.mime_type,
        status: d.status,
        storage_url: d.storage_url,
        file_size_bytes: d.file_size_bytes,
        type: null,
        category: null,
        text_cleaner_type: null,
        text_splitter_type: null,
        embedder_type: null,
        split_size: null,
        split_overlap: null,
        processing_started_at: d.processing_started_at,
        processing_finished_at: null,
        created_by: d.created_by,
        created_at: d.created_at,
        updated_by: null,
        updated_at: null,
        deleted_by: null,
        deleted_at: null,
      });
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        untracked(() => this.panelView.set('root'));
      }
    });
  }

  close(): void {
    this.isOpenChange.emit(false);
  }

  goRoot(): void {
    this.panelView.set('root');
  }

  openSub(view: Exclude<PanelView, 'root'>): void {
    if (this.contextChatId() == null) return;
    this.panelView.set(view);
    const cid = this.contextChatId()!;
    if (view === 'participants') {
      this.reloadMembers(cid);
    }
    if (view === 'documents') {
      this.reloadServerDocuments(cid);
    }
  }

  emitChatAction(action: string): void {
    const id = this.contextChatId();
    if (id == null) return;
    this.chatAction.emit({ chatId: id, action });
    this.close();
  }

  onDocumentInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.documentSelected.emit(file);
    }
    input.value = '';
  }

  reloadServerDocuments(chatId: number): void {
    this.documentsLoading.set(true);
    this.documentProcessingHttpService
      .listDocumentsByChat(chatId)
      .pipe(catchError(() => of([] as Document[])), take(1))
      .subscribe({
        next: (list) => {
          this.serverDocuments.set(list);
          this.documentsLoading.set(false);
        },
        error: () => this.documentsLoading.set(false),
      });
  }

  refreshDocumentsList(): void {
    const id = this.contextChatId();
    if (id != null) {
      this.reloadServerDocuments(id);
    }
  }

  renameChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const current = this.contextChatTitle()?.trim() || '';
    const next = window.prompt('Nuevo nombre del chat', current)?.trim();
    if (!next || next === current) return;
    this.chatHttpService.patchChat(cid, { name: next }).subscribe({
      next: () => {
        this.toastService.show('Nombre actualizado.', 'success');
        this.chatMetaUpdated.emit({ chatId: cid, name: next });
      },
      error: () => this.toastService.show('No se pudo actualizar el nombre.', 'error'),
    });
  }

  deleteChatClick(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Eliminar esta conversación?')) return;
    this.chatHttpService.deleteChat(cid).subscribe({
      next: () => {
        this.toastService.show('Chat eliminado.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'delete' });
        const url = this.router.url.split('?')[0];
        if (url.includes(`/main-container/chat/${cid}`)) {
          void this.router.navigate(['/main-container', 'chat-home']);
        }
        this.close();
      },
      error: () => this.toastService.show('No se pudo eliminar el chat.', 'error'),
    });
  }

  shareOrArchiveSoon(kind: 'share' | 'archive'): void {
    const msg = kind === 'share' ? 'Compartir: próximamente.' : 'Archivar: próximamente.';
    this.toastService.show(msg, 'success');
  }

  leaveChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Salir de este chat?')) return;
    this.chatHttpService.leaveChat(cid).subscribe({
      next: () => {
        this.toastService.show('Saliste del chat.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'leave' });
        this.close();
      },
      error: () => this.toastService.show('No se pudo abandonar el chat.', 'error'),
    });
  }

  addParticipantSoon(): void {
    this.toastService.show('Invitar participantes: próximamente.', 'success');
  }

  removeMember(row: ChatMembership): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Quitar a este participante del chat?')) return;
    this.chatHttpService.removeMember(cid, row.id).subscribe({
      next: () => {
        this.toastService.show('Participante eliminado.', 'success');
        this.reloadMembers(cid);
      },
      error: () => this.toastService.show('No se pudo quitar al participante.', 'error'),
    });
  }

  documentUpdateSoon(item: Document): void {
    void item;
    this.toastService.show('Actualizar documento: próximamente.', 'success');
  }

  private reloadMembers(chatId: number): void {
    this.membersLoading.set(true);
    this.chatHttpService
      .listMembers(chatId, { page_size: 100 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.members.set(page.data);
          this.membersLoading.set(false);
        },
        error: () => {
          this.membersLoading.set(false);
          this.toastService.show('No se pudieron cargar los participantes.', 'error');
        },
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      if (this.panelView() !== 'root') {
        this.goRoot();
      } else {
        this.close();
      }
    }
  }
}
