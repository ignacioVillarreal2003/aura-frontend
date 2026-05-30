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
  AURA_CHAT_WEBHOOK_EVENTS,
  type ChatExportBackupDto,
  type ChecklistListItemDto,
  type MembershipDto,
  type MembershipRole,
  type MembershipStatus,
  type MessageDto,
  type PinnedMessageDto,
  type ReportListItemDto,
  type ShareLinkDto,
  type WebhookDto,
  type WebhookEvent,
} from '@aura-types/aura-chat-service.types';

export interface ChatRef {
  readonly id: number;
  readonly name: string;
  readonly is_pinned: boolean;
  readonly archived_at: string | null;
  readonly is_locked: boolean;
  readonly is_muted: boolean;
}

export interface DocumentItem {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly created_at: string;
}

type PanelView = 'root' | 'documents' | 'participants' | 'add-participants' | 'chat' | 'share' | 'mute' | 'webhooks' | 'pinned' | 'bookmarks' | 'export' | 'reports' | 'checklists' | 'rename';

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
  readonly roleUpdatingId = signal<number | null>(null);
  readonly documentsLoading = signal(false);
  readonly fetchedDocuments = signal<readonly DocumentItem[]>([]);
  readonly downloadingDocId = signal<number | null>(null);
  readonly deletingDocId = signal<number | null>(null);
  readonly shareLinks = signal<ShareLinkDto[]>([]);
  readonly shareLinksLoading = signal(false);
  readonly webhooks = signal<WebhookDto[]>([]);
  readonly webhooksLoading = signal(false);
  readonly showWebhookForm = signal(false);
  readonly newWebhookUrl = signal('');
  readonly newWebhookEvents = signal<WebhookEvent[]>([]);
  readonly webhookEventOptions = AURA_CHAT_WEBHOOK_EVENTS as readonly WebhookEvent[];
  readonly pinnedMessages = signal<PinnedMessageDto[]>([]);
  readonly pinnedLoading = signal(false);
  readonly bookmarkedMessages = signal<MessageDto[]>([]);
  readonly bookmarkedLoading = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | 'json' | 'ai' | null>(null);

  readonly reports = signal<ReportListItemDto[]>([]);
  readonly reportsLoading = signal(false);
  readonly reportsPage = signal(1);
  readonly reportsHasNext = signal(false);
  readonly reportsHasPrev = signal(false);
  readonly reportsTotalCount = signal(0);
  private readonly reportsPageSize = 8;
  readonly exportingItemId = signal<number | null>(null);

  readonly checklists = signal<ChecklistListItemDto[]>([]);
  readonly checklistsLoading = signal(false);
  readonly checklistsPage = signal(1);
  readonly checklistsHasNext = signal(false);
  readonly checklistsHasPrev = signal(false);
  readonly checklistsTotalCount = signal(0);
  private readonly checklistsPageSize = 8;
  readonly renameValue = signal('');
  readonly renameSubmitting = signal(false);
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
      case 'webhooks': return 'Webhooks';
      case 'pinned': return 'Mensajes fijados';
      case 'bookmarks': return 'Guardados';
      case 'export': return 'Exportar chat';
      case 'reports': return 'Informes';
      case 'checklists': return 'Checklists';
      case 'rename': return 'Cambiar nombre';
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
    if (view === 'documents') {
      this.refreshDocumentsList();
    }
    if (view === 'participants') {
      this.reloadMembers(this.contextChatId()!);
    }
    if (view === 'share') {
      this.reloadShareLinks();
    }
    if (view === 'webhooks') {
      this.reloadWebhooks();
      this.cancelWebhookForm();
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
    if (view === 'pinned') {
      this.reloadPinnedMessages();
    }
    if (view === 'bookmarks') {
      this.reloadBookmarkedMessages();
    }
    if (view === 'export') {
      this.exportingAs.set(null);
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
    if (!window.confirm(`¿Eliminar el documento "${doc.name}"?`)) return;
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

  togglePin(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (this._pinned()) {
      this.chatHttp.unpinChat(cid).subscribe({
        next: () => {
          this._pinned.set(false);
          this.toastService.show('Chat desfijado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'unpin' });
          this.close();
        },
        error: () => this.toastService.show('No se pudo desfijar el chat.', 'error'),
      });
    } else {
      this.chatHttp.pinChat(cid).subscribe({
        next: () => {
          this._pinned.set(true);
          this.toastService.show('Chat fijado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'pin' });
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
          this.close();
        },
        error: () => this.toastService.show('No se pudo desarchivar el chat.', 'error'),
      });
    } else {
      this.chatHttp.archiveChats({ ids: [cid] }).subscribe({
        next: () => {
          this.toastService.show('Chat archivado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'archive' });
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
          this.close();
        },
        error: () => this.toastService.show('No se pudo desbloquear el chat.', 'error'),
      });
    } else {
      this.chatHttp.lockChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat bloqueado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'lock' });
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
    if (!window.confirm('¿Quitar a este participante del chat?')) return;
    this.chatHttp.removeMember(cid, row.id).subscribe({
      next: () => {
        this.toastService.show('Participante eliminado.', 'success');
        this.reloadMembers(cid);
      },
      error: () => this.toastService.show('No se pudo quitar al participante.', 'error'),
    });
  }


  clearChatHistory(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Limpiar todo el historial de mensajes? Esta acción no se puede deshacer.')) return;
    this.chatHttp.clearChatHistory(cid).subscribe({
      next: () => {
        this.toastService.show('Historial eliminado.', 'success');
        this.chatAction.emit({ chatId: cid, action: 'clear-history' });
        this.close();
      },
      error: () => this.toastService.show('No se pudo limpiar el historial.', 'error'),
    });
  }

  reloadWebhooks(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.webhooksLoading.set(true);
    this.chatHttp
      .listWebhooks(cid, { page_size: 20 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.webhooks.set([...page.results]);
          this.webhooksLoading.set(false);
        },
        error: () => {
          this.webhooksLoading.set(false);
          this.toastService.show('No se pudieron cargar los webhooks.', 'error');
        },
      });
  }

  isWebhookEventSelected(event: WebhookEvent): boolean {
    return this.newWebhookEvents().includes(event);
  }

  toggleWebhookEvent(event: WebhookEvent): void {
    const current = this.newWebhookEvents();
    this.newWebhookEvents.set(
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event]
    );
  }

  onWebhookUrlInput(domEvent: Event): void {
    this.newWebhookUrl.set((domEvent.target as HTMLInputElement).value);
  }

  cancelWebhookForm(): void {
    this.showWebhookForm.set(false);
    this.newWebhookUrl.set('');
    this.newWebhookEvents.set([]);
  }

  submitCreateWebhook(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const url = this.newWebhookUrl().trim();
    const events = this.newWebhookEvents();
    if (!url) {
      this.toastService.show('La URL del webhook es requerida.', 'error');
      return;
    }
    if (events.length === 0) {
      this.toastService.show('Seleccioná al menos un evento.', 'error');
      return;
    }
    this.chatHttp
      .createWebhook(cid, { url, events })
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.webhooks.update((list) => [created, ...list]);
          this.toastService.show('Webhook creado.', 'success');
          this.cancelWebhookForm();
        },
        error: () => this.toastService.show('No se pudo crear el webhook.', 'error'),
      });
  }

  toggleWebhookActive(webhook: WebhookDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.chatHttp
      .patchWebhook(cid, webhook.id, { is_active: !webhook.is_active })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.webhooks.update((list) => list.map((w) => (w.id === updated.id ? updated : w)));
        },
        error: () => this.toastService.show('No se pudo actualizar el webhook.', 'error'),
      });
  }

  deleteWebhookClick(webhookId: number): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Eliminar este webhook?')) return;
    this.chatHttp
      .deleteWebhook(cid, webhookId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.webhooks.update((list) => list.filter((w) => w.id !== webhookId));
          this.toastService.show('Webhook eliminado.', 'success');
        },
        error: () => this.toastService.show('No se pudo eliminar el webhook.', 'error'),
      });
  }

  reloadPinnedMessages(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.pinnedLoading.set(true);
    this.chatHttp
      .listPinnedMessages(cid, { page_size: 50 })
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
      .listBookmarkedMessages(cid, { page_size: 50 })
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

  exportChat(format: 'pdf' | 'markdown' | 'json' | 'ai'): void {
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
    } else if (format === 'ai') {
      this.chatHttp.exportAiResponsesMarkdown(cid).pipe(take(1)).subscribe({
        next: (blob) => { this.downloadBlob(blob, `${slug}-ia.md`); this.exportingAs.set(null); },
        error: onError,
      });
    } else if (format === 'json') {
      this.chatHttp.exportChatJsonBackup(cid).pipe(take(1)).subscribe({
        next: (data: ChatExportBackupDto) => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          this.downloadBlob(blob, `${slug}-backup.json`);
          this.exportingAs.set(null);
        },
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
    if (!window.confirm('¿Eliminar este informe?')) return;
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
    if (!window.confirm('¿Eliminar esta checklist?')) return;
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
