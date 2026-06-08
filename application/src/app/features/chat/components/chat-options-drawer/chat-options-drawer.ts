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
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { UserState } from '@core/state/user.state';
import {
  type ArtifactSummaryDto,
  type ChecklistListItemDto,
  type DecisionBriefListItemDto,
  type DocumentActionListItemDto,
  type DocumentSummaryListItemDto,
  type LessonsLearnedListItemDto,
  type MembershipDto,
  type MembershipRole,
  type MembershipStatus,
  type PinnedArtifactDto,
  type QuizListItemDto,
  type ReportListItemDto,
  type ShareLinkDto,
  type TimelineListItemDto,
} from '@aura-types/aura-chat-service.types';

export interface ChatRef {
  readonly id: number;
  readonly name: string;
  readonly is_pinned: boolean;
  readonly archived_at: string | null;
  readonly is_locked: boolean;
  readonly is_muted: boolean;
  readonly tags: readonly string[];
}

interface ConfirmOpts {
  readonly title: string;
  readonly description?: string;
  readonly onConfirm: () => void;
}

export interface DocumentItem {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly created_at: string;
}

type PanelView = 'root' | 'documents' | 'participants' | 'add-participants' | 'chat' | 'share' | 'mute' | 'pinned' | 'bookmarks' | 'export' | 'artifacts' | 'reports' | 'checklists' | 'rename' | 'tags';

export type ArtifactTabKey = 'reports' | 'checklists' | 'quizzes' | 'timelines' | 'lessons-learned' | 'decision-briefs' | 'document-summaries' | 'document-actions';

interface ArtifactTabItem {
  readonly id: number;
  readonly artifact_id: number;
  readonly title: string;
  readonly source_chat_id: number;
  readonly created_at: string;
}

const ARTIFACT_TAB_META: Record<ArtifactTabKey, { label: string; icon: string; permission: string; route: string; color: string }> = {
  'reports':            { label: 'Informes',     icon: 'pi-file-edit',     permission: 'LIST_REPORTS',             route: 'report',           color: '#a5b4fc' },
  'checklists':         { label: 'Checklists',   icon: 'pi-list-check',    permission: 'LIST_CHECKLISTS',          route: 'checklist',        color: '#86efac' },
  'quizzes':            { label: 'Quiz',         icon: 'pi-question-circle',permission: 'LIST_QUIZZES',            route: 'quiz',             color: '#fde68a' },
  'timelines':          { label: 'Línea tiempo', icon: 'pi-calendar',      permission: 'LIST_TIMELINES',           route: 'timeline',         color: '#7dd3fc' },
  'lessons-learned':    { label: 'Lecciones',    icon: 'pi-book',          permission: 'LIST_LESSONS_LEARNED',     route: 'lessons-learned',  color: '#f9a8d4' },
  'decision-briefs':    { label: 'Decisiones',   icon: 'pi-check-circle',  permission: 'LIST_DECISION_BRIEFS',     route: 'decision-brief',   color: '#c4b5fd' },
  'document-summaries': { label: 'Resúmenes',    icon: 'pi-file',          permission: 'LIST_DOCUMENT_SUMMARIES',  route: 'document-summary', color: '#5eead4' },
  'document-actions':   { label: 'Acciones doc', icon: 'pi-cog',           permission: 'LIST_DOCUMENT_ACTIONS',    route: 'document-action',  color: '#fdba74' },
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
export class ChatOptionsDrawer {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly docHttp = inject(AuraDocumentProcessingServiceHttp);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly userState = inject(UserState);

  readonly canListReports = computed(() =>
    this.userState.user()?.permissions.includes('LIST_REPORTS') ?? false
  );
  readonly canListChecklists = computed(() =>
    this.userState.user()?.permissions.includes('LIST_CHECKLISTS') ?? false
  );
  readonly canDownloadDocument = computed(() =>
    this.userState.user()?.permissions.includes('DOWNLOAD_DOCUMENT') ?? false
  );
  readonly canDeleteDocument = computed(() =>
    this.userState.user()?.permissions.includes('SOFT_DELETE_DOCUMENT') ?? false
  );

  readonly availableArtifactTabs = computed((): ArtifactTabKey[] => {
    const perms = this.userState.user()?.permissions ?? [];
    return (Object.keys(ARTIFACT_TAB_META) as ArtifactTabKey[]).filter(
      (k) => perms.includes(ARTIFACT_TAB_META[k].permission)
    );
  });

  readonly canSeeArtifacts = computed(() => this.availableArtifactTabs().length > 0);

  readonly selectedArtifactTab = signal<ArtifactTabKey>('reports');
  readonly artifactsItems = signal<ArtifactTabItem[]>([]);
  readonly artifactsLoading = signal(false);
  readonly artifactsPage = signal(1);
  readonly artifactsHasNext = signal(false);
  readonly artifactsHasPrev = signal(false);
  readonly artifactsTotalCount = signal(0);
  private readonly artifactsPageSize = 10;

  readonly isOpen = input.required<boolean>();
  readonly isOpenChange = output<boolean>();
  readonly panelTitle = input<string>('Opciones del chat');

  readonly contextChat = input<ChatRef | null>(null);

  readonly attachedDocuments = input<readonly DocumentItem[]>([]);

  readonly uploadDisabled = input(false);

  readonly documentSelected = output<File>();
  readonly chatAction = output<{ chatId: number; action: string; tags?: readonly string[] }>();
  readonly chatMetaUpdated = output<{ chatId: number; name: string }>();

  readonly panelView = signal<PanelView>('root');
  readonly members = signal<MembershipDto[]>([]);
  readonly membersLoading = signal(false);
  readonly roleUpdatingId = signal<number | null>(null);
  readonly documentsLoading = signal(false);
  readonly fetchedDocuments = signal<readonly DocumentItem[]>([]);
  readonly downloadingDocId = signal<number | null>(null);
  readonly deletingDocId = signal<number | null>(null);
  readonly shareLinks = signal<ShareLinkDto[]>([]);
  readonly shareLinksLoading = signal(false);
  readonly pinnedMessages = signal<PinnedArtifactDto[]>([]);
  readonly pinnedLoading = signal(false);
  readonly bookmarkedMessages = signal<ArtifactSummaryDto[]>([]);
  readonly bookmarkedLoading = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly reports = signal<ReportListItemDto[]>([]);
  readonly reportsLoading = signal(false);
  readonly reportsPage = signal(1);
  readonly reportsHasNext = signal(false);
  readonly reportsHasPrev = signal(false);
  readonly reportsTotalCount = signal(0);
  private readonly reportsPageSize = 8;
  readonly exportingItemId = signal<number | null>(null);

  readonly pendingConfirm = signal<ConfirmOpts | null>(null);

  readonly checklists = signal<ChecklistListItemDto[]>([]);
  readonly checklistsLoading = signal(false);
  readonly checklistsPage = signal(1);
  readonly checklistsHasNext = signal(false);
  readonly checklistsHasPrev = signal(false);
  readonly checklistsTotalCount = signal(0);
  private readonly checklistsPageSize = 8;
  readonly renameValue = signal('');
  readonly renameSubmitting = signal(false);
  readonly tagsInput = signal('');
  readonly tagsDraft = signal<string[]>([]);
  readonly tagsSubmitting = signal(false);
  readonly inviteInput = signal('');
  readonly inviteIds = signal<number[]>([]);
  readonly inviting = signal(false);

  readonly headerTitle = computed(() => {
    switch (this.panelView()) {
      case 'add-participants': return 'Añadir participantes';
      case 'chat': return 'Gestionar chat';
      case 'participants': return 'Participantes';
      case 'documents': return 'Documentos';
      case 'share': return 'Compartir';
      case 'mute': return 'Silenciar chat';
      case 'pinned': return 'Mensajes fijados';
      case 'bookmarks': return 'Guardados';
      case 'export': return 'Exportar chat';
      case 'artifacts': return 'Artefactos';
      case 'reports': return 'Informes';
      case 'checklists': return 'Checklists';
      case 'rename': return 'Cambiar nombre';
      case 'tags': return 'Etiquetas';
      default: return this.panelTitle();
    }
  });

  readonly contextChatId = computed(() => this.contextChat()?.id ?? null);
  readonly contextChatTitle = computed(() => this.contextChat()?.name ?? '');

  private readonly _pinned = signal(false);
  private _pinnedInitForId: number | null = null;
  readonly isChatPinned = computed(() => this._pinned());

  readonly isChatArchived = computed(() => this.contextChat()?.archived_at != null);
  readonly isChatLocked = computed(() => this.contextChat()?.is_locked ?? false);
  readonly isChatMuted = computed(() => this.contextChat()?.is_muted ?? false);

  readonly mergedDocuments = computed((): DocumentItem[] => {
    const byId = new Map<number, DocumentItem>();
    for (const doc of this.fetchedDocuments()) byId.set(doc.id, doc);
    for (const doc of this.attachedDocuments()) byId.set(doc.id, doc);
    return [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  constructor() {
    effect(() => {
      const chat = this.contextChat();
      const chatId = chat?.id ?? null;
      if (chatId !== this._pinnedInitForId) {
        this._pinnedInitForId = chatId;
        untracked(() => this._pinned.set(chat?.is_pinned ?? false));
      }
    });
    effect(() => {
      if (!this.isOpen()) {
        untracked(() => {
          this.panelView.set('root');
          this.pendingConfirm.set(null);
        });
      }
    });
  }

  close(): void {
    this.isOpenChange.emit(false);
  }

  requestConfirm(opts: ConfirmOpts): void {
    this.pendingConfirm.set(opts);
  }

  cancelConfirm(): void {
    this.pendingConfirm.set(null);
  }

  runConfirm(): void {
    const opts = this.pendingConfirm();
    if (!opts) return;
    this.pendingConfirm.set(null);
    opts.onConfirm();
  }

  goRoot(): void {
    this.panelView.set('root');
  }

  openSub(view: Exclude<PanelView, 'root'>): void {
    if (this.contextChatId() == null) return;
    this.panelView.set(view);
    if (view === 'documents') {
      this.refreshDocumentsList();
    }
    if (view === 'participants') {
      this.reloadMembers(this.contextChatId()!);
    }
    if (view === 'share') {
      this.reloadShareLinks();
    }
    if (view === 'rename') {
      this.renameValue.set(this.contextChatTitle()?.trim() ?? '');
      this.renameSubmitting.set(false);
    }
    if (view === 'add-participants') {
      this.inviteInput.set('');
      this.inviteIds.set([]);
      this.inviting.set(false);
    }
    if (view === 'tags') {
      this.tagsDraft.set([...(this.contextChat()?.tags ?? [])]);
      this.tagsInput.set('');
      this.tagsSubmitting.set(false);
    }
    if (view === 'pinned') {
      this.reloadPinnedMessages();
    }
    if (view === 'bookmarks') {
      this.reloadBookmarkedMessages();
    }
    if (view === 'export') {
      this.exportingAs.set(null);
    }
    if (view === 'artifacts') {
      const firstTab = this.availableArtifactTabs()[0];
      if (firstTab) {
        this.selectedArtifactTab.set(firstTab);
        this.artifactsPage.set(1);
        this.reloadArtifactsTab();
      }
    }
    if (view === 'reports') {
      this.reportsPage.set(1);
      this.reloadReports();
    }
    if (view === 'checklists') {
      this.checklistsPage.set(1);
      this.reloadChecklists();
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
    const chatId = this.contextChatId();
    if (chatId == null || this.documentsLoading()) return;
    this.documentsLoading.set(true);
    this.docHttp.listDocumentsByChat(chatId).pipe(take(1)).subscribe({
      next: (res) => {
        this.fetchedDocuments.set(res.documents.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          created_at: d.created_at,
        })));
        this.documentsLoading.set(false);
      },
      error: () => {
        this.toastService.show('No se pudieron cargar los documentos.', 'error');
        this.documentsLoading.set(false);
      },
    });
  }

  downloadDocument(doc: DocumentItem): void {
    if (this.downloadingDocId() !== null) return;
    this.downloadingDocId.set(doc.id);
    this.docHttp.downloadDocument(doc.id).pipe(take(1)).subscribe({
      next: (blob) => {
        this.downloadingDocId.set(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingDocId.set(null);
        this.toastService.show('No se pudo descargar el documento.', 'error');
      },
    });
  }

  deleteDocument(doc: DocumentItem): void {
    this.requestConfirm({
      title: `¿Eliminar "${doc.name}"?`,
      onConfirm: () => {
        if (this.deletingDocId() !== null) return;
        this.deletingDocId.set(doc.id);
        this.docHttp.deleteDocument(doc.id).pipe(take(1)).subscribe({
          next: () => {
            this.deletingDocId.set(null);
            this.fetchedDocuments.update((docs) => docs.filter((d) => d.id !== doc.id));
            this.toastService.show('Documento eliminado.', 'success');
          },
          error: () => {
            this.deletingDocId.set(null);
            this.toastService.show('No se pudo eliminar el documento.', 'error');
          },
        });
      },
    });
  }

  addTag(): void {
    const raw = this.tagsInput().trim().toLowerCase();
    if (!raw) return;
    if (this.tagsDraft().includes(raw)) {
      this.toastService.show('Esa etiqueta ya existe.', 'error');
      return;
    }
    this.tagsDraft.update(tags => [...tags, raw]);
    this.tagsInput.set('');
  }

  removeTag(tag: string): void {
    this.tagsDraft.update(tags => tags.filter(t => t !== tag));
  }

  submitTags(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.tagsSubmitting.set(true);
    this.chatHttp.patchChat(cid, { tags: this.tagsDraft() }).subscribe({
      next: () => {
        this.toastService.show('Etiquetas actualizadas.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'tags-updated', tags: this.tagsDraft() });
        this.tagsSubmitting.set(false);
        this.openSub('chat');
      },
      error: () => {
        this.toastService.show('No se pudieron guardar las etiquetas.', 'error');
        this.tagsSubmitting.set(false);
      },
    });
  }

  submitRename(): void {
    const cid = this.contextChatId();
    const next = this.renameValue().trim();
    const current = this.contextChatTitle()?.trim() || '';
    if (cid == null || !next || next === current) return;
    this.renameSubmitting.set(true);
    this.chatHttp.patchChat(cid, { name: next }).subscribe({
      next: () => {
        this.toastService.show('Nombre actualizado.', 'success');
        this.chatMetaUpdated.emit({ chatId: cid, name: next });
        this.renameSubmitting.set(false);
        this.openSub('chat');
      },
      error: () => {
        this.toastService.show('No se pudo actualizar el nombre.', 'error');
        this.renameSubmitting.set(false);
      },
    });
  }

  deleteChatClick(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.requestConfirm({
      title: '¿Eliminar esta conversación?',
      description: 'Esta acción no se puede deshacer.',
      onConfirm: () => {
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
      },
    });
  }

  togglePin(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (this._pinned()) {
      this.chatHttp.unpinChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat desfijado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'unpin' });
          if (this.contextChatId() !== cid) return;
          this._pinned.set(false);
          this.close();
        },
        error: () => this.toastService.show('No se pudo desfijar el chat.', 'error'),
      });
    } else {
      this.chatHttp.pinChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat fijado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'pin' });
          if (this.contextChatId() !== cid) return;
          this._pinned.set(true);
          this.close();
        },
        error: () => this.toastService.show('No se pudo fijar el chat.', 'error'),
      });
    }
  }

  archiveChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (this.isChatArchived()) {
      this.chatHttp.unarchiveChats({ ids: [cid] }).subscribe({
        next: () => {
          this.toastService.show('Chat desarchivado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'unarchive' });
          if (this.contextChatId() !== cid) return;
          this.close();
        },
        error: () => this.toastService.show('No se pudo desarchivar el chat.', 'error'),
      });
    } else {
      this.chatHttp.archiveChats({ ids: [cid] }).subscribe({
        next: () => {
          this.toastService.show('Chat archivado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'archive' });
          if (this.contextChatId() !== cid) return;
          this.close();
        },
        error: () => this.toastService.show('No se pudo archivar el chat.', 'error'),
      });
    }
  }

  toggleLock(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (this.isChatLocked()) {
      this.chatHttp.unlockChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat desbloqueado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'unlock' });
          if (this.contextChatId() !== cid) return;
          this.close();
        },
        error: () => this.toastService.show('No se pudo desbloquear el chat.', 'error'),
      });
    } else {
      this.chatHttp.lockChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat bloqueado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'lock' });
          if (this.contextChatId() !== cid) return;
          this.close();
        },
        error: () => this.toastService.show('No se pudo bloquear el chat.', 'error'),
      });
    }
  }

  muteFor(hours: number): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const muted_until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    this.chatHttp.muteChat(cid, { muted_until }).subscribe({
      next: () => {
        this.toastService.show('Chat silenciado.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'mute' });
        if (this.contextChatId() !== cid) return;
        this.close();
      },
      error: () => this.toastService.show('No se pudo silenciar el chat.', 'error'),
    });
  }

  unmute(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.chatHttp.unmuteChat(cid).subscribe({
      next: () => {
        this.toastService.show('Sonido activado.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'unmute' });
        if (this.contextChatId() !== cid) return;
        this.close();
      },
      error: () => this.toastService.show('No se pudo activar el sonido.', 'error'),
    });
  }

  reloadShareLinks(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.shareLinksLoading.set(true);
    this.chatHttp
      .listShareLinks(cid, { page_size: 20 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.shareLinks.set([...page.results]);
          this.shareLinksLoading.set(false);
        },
        error: () => {
          this.shareLinksLoading.set(false);
          this.toastService.show('No se pudieron cargar los enlaces.', 'error');
        },
      });
  }

  createShareLink(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.chatHttp
      .createShareLink(cid)
      .pipe(take(1))
      .subscribe({
        next: (link) => {
          this.shareLinks.update((links) => [link, ...links]);
          this.toastService.show('Enlace creado.', 'success');
        },
        error: () => this.toastService.show('No se pudo crear el enlace.', 'error'),
      });
  }

  readonly revokeConfirmId = signal<number | null>(null);
  readonly revoking = signal(false);

  requestRevoke(linkId: number): void {
    this.revokeConfirmId.set(linkId);
  }

  cancelRevoke(): void {
    this.revokeConfirmId.set(null);
  }

  confirmRevoke(linkId: number): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.revoking.set(true);
    this.chatHttp
      .revokeShareLink(cid, linkId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.shareLinks.update((links) => links.filter((l) => l.id !== linkId));
          this.toastService.show('Enlace revocado.', 'success');
          this.revokeConfirmId.set(null);
          this.revoking.set(false);
        },
        error: () => {
          this.toastService.show('No se pudo revocar el enlace.', 'error');
          this.revoking.set(false);
        },
      });
  }

  copyShareLink(token: string): void {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(
      () => this.toastService.show('Enlace copiado.', 'success'),
      () => this.toastService.show('No se pudo copiar el enlace.', 'error'),
    );
  }

  leaveChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.requestConfirm({
      title: '¿Salir de este chat?',
      onConfirm: () => {
        this.chatHttp.leaveChat(cid).subscribe({
          next: () => {
            this.toastService.show('Saliste del chat.', 'success');
            this.chatAction.emit({ chatId: cid, action: 'leave' });
            this.close();
          },
          error: () => this.toastService.show('No se pudo abandonar el chat.', 'error'),
        });
      },
    });
  }

  addInviteId(): void {
    const raw = this.inviteInput().trim();
    if (!raw) return;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id) || id <= 0) {
      this.toastService.show('ID inválido. Ingresá un número positivo.', 'error');
      return;
    }
    if (this.inviteIds().includes(id)) {
      this.toastService.show('Ese ID ya está en la lista.', 'error');
      return;
    }
    this.inviteIds.update((ids) => [...ids, id]);
    this.inviteInput.set('');
  }

  removeInviteId(id: number): void {
    this.inviteIds.update((ids) => ids.filter((i) => i !== id));
  }

  submitInvite(): void {
    const cid = this.contextChatId();
    if (cid == null || this.inviteIds().length === 0) return;
    this.inviting.set(true);
    this.chatHttp.addMembers(cid, { member_ids: this.inviteIds() }).subscribe({
      next: (added) => {
        this.toastService.show(`${added.length} participante(s) invitado(s).`, 'success');
        this.inviting.set(false);
        this.panelView.set('participants');
        this.reloadMembers(cid);
      },
      error: () => {
        this.toastService.show('No se pudieron agregar los participantes.', 'error');
        this.inviting.set(false);
      },
    });
  }

  changeRoleTo(member: MembershipDto, role: MembershipRole): void {
    const cid = this.contextChatId();
    if (cid == null || member.role === role) return;
    this.roleUpdatingId.set(member.id);
    this.chatHttp.patchMemberRole(cid, member.member_id, { role }).subscribe({
      next: (updated) => {
        this.toastService.show('Rol actualizado.', 'success');
        this.members.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
        this.roleUpdatingId.set(null);
      },
      error: () => {
        this.toastService.show('No se pudo actualizar el rol. Solo el dueño del chat puede cambiar roles.', 'error');
        // Revert the select to the previous value by forcing a re-read of members
        this.members.update((list) => [...list]);
        this.roleUpdatingId.set(null);
      },
    });
  }

  statusLabel(status: MembershipStatus): string {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  }

  removeMember(row: MembershipDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.requestConfirm({
      title: '¿Quitar a este participante?',
      onConfirm: () => {
        this.chatHttp.removeMember(cid, row.id).subscribe({
          next: () => {
            this.toastService.show('Participante eliminado.', 'success');
            this.reloadMembers(cid);
          },
          error: () => this.toastService.show('No se pudo quitar al participante.', 'error'),
        });
      },
    });
  }


  clearChatHistory(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.requestConfirm({
      title: '¿Limpiar el historial de mensajes?',
      description: 'Esta acción no se puede deshacer.',
      onConfirm: () => {
        this.chatHttp.clearChatHistory(cid).subscribe({
          next: () => {
            this.toastService.show('Historial eliminado.', 'success');
            this.chatAction.emit({ chatId: cid, action: 'clear-history' });
            this.close();
          },
          error: () => this.toastService.show('No se pudo limpiar el historial.', 'error'),
        });
      },
    });
  }

  reloadPinnedMessages(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.pinnedLoading.set(true);
    this.chatHttp
      .listPinnedArtifacts(cid, { page_size: 50 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.pinnedMessages.set([...page.results]);
          this.pinnedLoading.set(false);
        },
        error: () => {
          this.pinnedLoading.set(false);
          this.toastService.show('No se pudieron cargar los mensajes fijados.', 'error');
        },
      });
  }

  reloadBookmarkedMessages(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.bookmarkedLoading.set(true);
    this.chatHttp
      .listBookmarkedArtifacts(cid, { page_size: 50 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.bookmarkedMessages.set([...page.results]);
          this.bookmarkedLoading.set(false);
        },
        error: () => {
          this.bookmarkedLoading.set(false);
          this.toastService.show('No se pudieron cargar los guardados.', 'error');
        },
      });
  }

  exportChat(format: 'pdf' | 'markdown'): void {
    const cid = this.contextChatId();
    if (cid == null || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (this.contextChatTitle() || `chat-${cid}`).replace(/[^\w-]/g, '_').slice(0, 60);
    const onError = () => {
      this.toastService.show('No se pudo exportar el chat.', 'error');
      this.exportingAs.set(null);
    };
    if (format === 'pdf') {
      this.chatHttp.exportChatPdf(cid).pipe(take(1)).subscribe({
        next: (blob) => { this.downloadBlob(blob, `${slug}.pdf`); this.exportingAs.set(null); },
        error: onError,
      });
    } else if (format === 'markdown') {
      this.chatHttp.exportChatMarkdown(cid).pipe(take(1)).subscribe({
        next: (blob) => { this.downloadBlob(blob, `${slug}.md`); this.exportingAs.set(null); },
        error: onError,
      });
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  reloadMembers(chatId: number): void {
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

  // ── Artifacts tab ────────────────────────────────────────────────────────
  readonly artifactTabMeta = ARTIFACT_TAB_META;

  selectArtifactTab(key: ArtifactTabKey): void {
    this.selectedArtifactTab.set(key);
    this.artifactsPage.set(1);
    this.reloadArtifactsTab();
  }

  artifactsNextPage(): void {
    this.artifactsPage.update((p) => p + 1);
    this.reloadArtifactsTab();
  }

  artifactsPrevPage(): void {
    this.artifactsPage.update((p) => p - 1);
    this.reloadArtifactsTab();
  }

  openArtifact(item: ArtifactTabItem): void {
    const tab = this.selectedArtifactTab();
    const route = ARTIFACT_TAB_META[tab].route;
    void this.router.navigate(['/main-container', route, item.id]);
    this.close();
  }

  reloadArtifactsTab(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const tab = this.selectedArtifactTab();
    const page = this.artifactsPage();
    const page_size = this.artifactsPageSize;
    this.artifactsLoading.set(true);
    this.artifactsItems.set([]);

    type CommonItem = { id: number; artifact_id: number; title: string; source_chat_id: number; created_at: string };
    const toItems = (results: CommonItem[]): ArtifactTabItem[] =>
      results.map((r) => ({ id: r.id, artifact_id: r.artifact_id, title: r.title, source_chat_id: r.source_chat_id, created_at: r.created_at }));

    const query = { chat_id: cid, page, page_size };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let req$: any;
    switch (tab) {
      case 'reports':            req$ = this.chatHttp.listReports(query); break;
      case 'checklists':         req$ = this.chatHttp.listChecklists(query); break;
      case 'quizzes':            req$ = this.chatHttp.listQuizzes(query); break;
      case 'timelines':          req$ = this.chatHttp.listTimelines(query); break;
      case 'lessons-learned':    req$ = this.chatHttp.listLessonsLearned(query); break;
      case 'decision-briefs':    req$ = this.chatHttp.listDecisionBriefs(query); break;
      case 'document-summaries': req$ = this.chatHttp.listDocumentSummaries(query); break;
      case 'document-actions':   req$ = this.chatHttp.listDocumentActions(query); break;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (req$ as ReturnType<typeof this.chatHttp.listReports>).pipe(take(1)).subscribe({
      next: (p) => {
        this.artifactsItems.set(toItems(p.results as unknown as CommonItem[]));
        this.artifactsHasNext.set(p.next !== null);
        this.artifactsHasPrev.set(p.previous !== null);
        this.artifactsTotalCount.set(p.count);
        this.artifactsLoading.set(false);
      },
      error: () => {
        this.artifactsLoading.set(false);
        this.toastService.show('No se pudieron cargar los artefactos.', 'error');
      },
    });
  }

  // ── Reports ──────────────────────────────────────────────────────────────
  reloadReports(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.reportsLoading.set(true);
    this.chatHttp
      .listReports({ chat_id: cid, page: this.reportsPage(), page_size: this.reportsPageSize })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.reports.set([...page.results]);
          this.reportsHasNext.set(page.next !== null);
          this.reportsHasPrev.set(page.previous !== null);
          this.reportsTotalCount.set(page.count);
          this.reportsLoading.set(false);
        },
        error: () => {
          this.reportsLoading.set(false);
          this.toastService.show('No se pudieron cargar los informes.', 'error');
        },
      });
  }

  openReport(reportId: number): void {
    void this.router.navigate(['/main-container', 'report', reportId]);
    this.close();
  }

  reportsNextPage(): void {
    this.reportsPage.update((p) => p + 1);
    this.reloadReports();
  }

  reportsPrevPage(): void {
    this.reportsPage.update((p) => p - 1);
    this.reloadReports();
  }

  deleteReport(reportId: number): void {
    this.requestConfirm({
      title: '¿Eliminar este informe?',
      onConfirm: () => {
        this.chatHttp
          .deleteReport(reportId)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.reports.update((list) => list.filter((r) => r.id !== reportId));
              this.toastService.show('Informe eliminado.', 'success');
              if (this.reports().length === 0 && this.reportsPage() > 1) {
                this.reportsPage.update((p) => p - 1);
                this.reloadReports();
              } else {
                this.reportsTotalCount.update((c) => c - 1);
              }
            },
            error: () => this.toastService.show('No se pudo eliminar el informe.', 'error'),
          });
      },
    });
  }

  exportReport(reportId: number, format: 'pdf' | 'markdown', title: string): void {
    if (this.exportingItemId() != null) return;
    this.exportingItemId.set(reportId);
    const slug = (title || `informe-${reportId}`).replace(/[^\w-]/g, '_').slice(0, 60);
    const req$ =
      format === 'pdf'
        ? this.chatHttp.exportReportPdf(reportId)
        : this.chatHttp.exportReportMarkdown(reportId);
    req$.pipe(take(1)).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `${slug}.${format === 'pdf' ? 'pdf' : 'md'}`);
        this.exportingItemId.set(null);
      },
      error: () => {
        this.exportingItemId.set(null);
        this.toastService.show('No se pudo exportar el informe.', 'error');
      },
    });
  }

  // ── Checklists ───────────────────────────────────────────────────────────
  reloadChecklists(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.checklistsLoading.set(true);
    this.chatHttp
      .listChecklists({ chat_id: cid, page: this.checklistsPage(), page_size: this.checklistsPageSize })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.checklists.set([...page.results]);
          this.checklistsHasNext.set(page.next !== null);
          this.checklistsHasPrev.set(page.previous !== null);
          this.checklistsTotalCount.set(page.count);
          this.checklistsLoading.set(false);
        },
        error: () => {
          this.checklistsLoading.set(false);
          this.toastService.show('No se pudieron cargar las checklists.', 'error');
        },
      });
  }

  openChecklist(checklistId: number): void {
    void this.router.navigate(['/main-container', 'checklist', checklistId]);
    this.close();
  }

  checklistsNextPage(): void {
    this.checklistsPage.update((p) => p + 1);
    this.reloadChecklists();
  }

  checklistsPrevPage(): void {
    this.checklistsPage.update((p) => p - 1);
    this.reloadChecklists();
  }

  deleteChecklist(checklistId: number): void {
    this.requestConfirm({
      title: '¿Eliminar esta checklist?',
      onConfirm: () => {
        this.chatHttp
          .deleteChecklist(checklistId)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.checklists.update((list) => list.filter((c) => c.id !== checklistId));
              this.toastService.show('Checklist eliminada.', 'success');
              if (this.checklists().length === 0 && this.checklistsPage() > 1) {
                this.checklistsPage.update((p) => p - 1);
                this.reloadChecklists();
              } else {
                this.checklistsTotalCount.update((c) => c - 1);
              }
            },
            error: () => this.toastService.show('No se pudo eliminar la checklist.', 'error'),
          });
      },
    });
  }

  exportChecklist(checklistId: number, format: 'pdf' | 'markdown', title: string): void {
    if (this.exportingItemId() != null) return;
    this.exportingItemId.set(checklistId);
    const slug = (title || `checklist-${checklistId}`).replace(/[^\w-]/g, '_').slice(0, 60);
    const req$ =
      format === 'pdf'
        ? this.chatHttp.exportChecklistPdf(checklistId)
        : this.chatHttp.exportChecklistMarkdown(checklistId);
    req$.pipe(take(1)).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `${slug}.${format === 'pdf' ? 'pdf' : 'md'}`);
        this.exportingItemId.set(null);
      },
      error: () => {
        this.exportingItemId.set(null);
        this.toastService.show('No se pudo exportar la checklist.', 'error');
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
