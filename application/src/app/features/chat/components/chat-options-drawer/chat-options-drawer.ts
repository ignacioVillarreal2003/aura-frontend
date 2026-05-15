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
import { take } from 'rxjs';
import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { MembershipDto } from '@types/aura-chat-service.types';

export interface ChatRef {
  readonly id: number;
  readonly name: string;
}

export interface DocumentItem {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly created_at: string;
}

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
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly isOpenChange = output<boolean>();
  readonly panelTitle = input<string>('Opciones del chat');

  readonly contextChat = input<ChatRef | null>(null);

  readonly attachedDocuments = input<readonly DocumentItem[]>([]);

  readonly uploadDisabled = input(false);

  readonly documentSelected = output<File>();
  readonly chatAction = output<{ chatId: number; action: string }>();
  readonly chatMetaUpdated = output<{ chatId: number; name: string }>();

  readonly panelView = signal<PanelView>('root');
  readonly members = signal<MembershipDto[]>([]);
  readonly membersLoading = signal(false);
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

  readonly mergedDocuments = computed((): DocumentItem[] =>
    [...this.attachedDocuments()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  );

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
    if (view === 'participants') {
      this.reloadMembers(this.contextChatId()!);
    }
  }

  emitChatAction(action: string): void {
    const id = this.contextChatId();
    if (id == null) return;
    this.chatAction.emit({ chatId: id, action });
    this.close();
  }

  onDocumentInput(event: Event): void {
    const inp = event.target as HTMLInputElement;
    const file = inp.files?.[0];
    if (file) {
      this.documentSelected.emit(file);
    }
    inp.value = '';
  }

  refreshDocumentsList(): void {
    // Documents update reactively via attachedDocuments input from parent
  }

  renameChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const current = this.contextChatTitle()?.trim() || '';
    const next = window.prompt('Nuevo nombre del chat', current)?.trim();
    if (!next || next === current) return;
    this.chatHttp.patchChat(cid, { name: next }).subscribe({
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
    this.chatHttp.deleteChat(cid).subscribe({
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
    this.chatHttp.leaveChat(cid).subscribe({
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

  removeMember(row: MembershipDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Quitar a este participante del chat?')) return;
    this.chatHttp.removeMember(cid, row.id).subscribe({
      next: () => {
        this.toastService.show('Participante eliminado.', 'success');
        this.reloadMembers(cid);
      },
      error: () => this.toastService.show('No se pudo quitar al participante.', 'error'),
    });
  }

  documentUpdateSoon(item: DocumentItem): void {
    void item;
    this.toastService.show('Actualizar documento: próximamente.', 'success');
  }

  private reloadMembers(chatId: number): void {
    this.membersLoading.set(true);
    this.chatHttp
      .listMembers(chatId, { page_size: 100 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.members.set([...page.results]);
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
