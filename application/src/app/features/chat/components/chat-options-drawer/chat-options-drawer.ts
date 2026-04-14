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
import { catchError, of, take } from 'rxjs';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { DocumentProcessingHttpService } from '@core/services/http/document-processing-http.service';
import { ToastService } from '@core/components/toast-service';
import type { CreateDocumentResponse, DocumentResponse } from '@core/models/types/document.types';
import type { ChatMembershipRow } from '@core/models/types/chat.types';

type PanelView = 'root' | 'documents' | 'participants' | 'chat';

type DocListItem = {
  id: number;
  name: string;
  status: string;
  created_at: string;
};

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
export class ChatOptionsDrawerComponent {
  private readonly api = inject(AuraChatApiService);
  private readonly documentsHttp = inject(DocumentProcessingHttpService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly isOpenChange = output<boolean>();
  readonly panelTitle = input<string>('Opciones del chat');

  /** Chat activo (sesión o sidebar); si es null, el cuerpo muestra un aviso vacío. */
  readonly contextChatId = input<number | null>(null);
  readonly contextChatTitle = input<string>('');

  /** Documentos subidos en esta sesión (p. ej. respuestas de `createDocument`). */
  readonly attachedDocuments = input<readonly CreateDocumentResponse[]>([]);

  readonly uploadDisabled = input(false);

  readonly documentSelected = output<File>();
  readonly chatAction = output<{ chatId: number; action: string }>();
  readonly chatMetaUpdated = output<{ chatId: number; name: string }>();

  readonly panelView = signal<PanelView>('root');
  readonly members = signal<ChatMembershipRow[]>([]);
  readonly membersLoading = signal(false);
  readonly serverDocuments = signal<DocumentResponse[]>([]);
  readonly documentsLoading = signal(false);

  readonly headerTitle = computed(() => {
    switch (this.panelView()) {
      case 'documents':
        return 'Documentos';
      case 'participants':
        return 'Participantes';
      case 'chat':
        return 'Chat';
      default:
        return this.panelTitle();
    }
  });

  readonly mergedDocuments = computed((): DocListItem[] => {
    const map = new Map<number, DocListItem>();
    for (const d of this.serverDocuments()) {
      map.set(d.id, { id: d.id, name: d.name, status: d.status, created_at: d.created_at });
    }
    for (const d of this.attachedDocuments()) {
      map.set(d.id, { id: d.id, name: d.name, status: d.status, created_at: d.created_at });
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
    this.documentsHttp
      .listDocumentsByChat(chatId)
      .pipe(catchError(() => of([] as DocumentResponse[])), take(1))
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
    this.api.patchChat(cid, { name: next }).subscribe({
      next: () => {
        this.toast.show('Nombre actualizado.', 'success');
        this.chatMetaUpdated.emit({ chatId: cid, name: next });
      },
      error: () => this.toast.show('No se pudo actualizar el nombre.', 'error'),
    });
  }

  deleteChatClick(): void {
    this.emitChatAction('delete');
  }

  shareOrArchiveSoon(kind: 'share' | 'archive'): void {
    const msg = kind === 'share' ? 'Compartir: próximamente.' : 'Archivar: próximamente.';
    this.toast.show(msg, 'success');
  }

  leaveChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Salir de este chat?')) return;
    this.api.leaveChat(cid).subscribe({
      next: () => {
        this.toast.show('Saliste del chat.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'leave' });
        this.close();
      },
      error: () => this.toast.show('No se pudo abandonar el chat.', 'error'),
    });
  }

  addParticipantSoon(): void {
    this.toast.show('Invitar participantes: próximamente.', 'success');
  }

  removeMember(row: ChatMembershipRow): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Quitar a este participante del chat?')) return;
    this.api.removeMember(cid, row.id).subscribe({
      next: () => {
        this.toast.show('Participante eliminado.', 'success');
        this.reloadMembers(cid);
      },
      error: () => this.toast.show('No se pudo quitar al participante.', 'error'),
    });
  }

  documentUpdateSoon(item: DocListItem): void {
    void item;
    this.toast.show('Actualizar documento: próximamente.', 'success');
  }

  private reloadMembers(chatId: number): void {
    this.membersLoading.set(true);
    this.api
      .listMembers(chatId, { page_size: 100 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.members.set(page.data);
          this.membersLoading.set(false);
        },
        error: () => {
          this.membersLoading.set(false);
          this.toast.show('No se pudieron cargar los participantes.', 'error');
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
