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
import {
  AURA_CHAT_WEBHOOK_EVENTS,
  type ChatExportBackupDto,
  type MembershipDto,
  type MembershipRole,
  type MembershipStatus,
  type MessageDto,
  type PinnedMessageDto,
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

type PanelView = 'root' | 'documents' | 'participants' | 'chat' | 'share' | 'mute' | 'webhooks' | 'pinned' | 'bookmarks' | 'export';

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

  readonly headerTitle = computed(() => {
    switch (this.panelView()) {
      case 'chat': return 'Gestionar chat';
      case 'participants': return 'Participantes';
      case 'documents': return 'Documentos';
      case 'share': return 'Compartir';
      case 'mute': return 'Silenciar chat';
      case 'webhooks': return 'Webhooks';
      case 'pinned': return 'Mensajes fijados';
      case 'bookmarks': return 'Guardados';
      case 'export': return 'Exportar chat';
      default: return this.panelTitle();
    }
  });

  readonly contextChatId = computed(() => this.contextChat()?.id ?? null);
  readonly contextChatTitle = computed(() => this.contextChat()?.name ?? '');
  readonly isChatPinned = computed(() => this.contextChat()?.is_pinned ?? false);
  readonly isChatArchived = computed(() => this.contextChat()?.archived_at != null);
  readonly isChatLocked = computed(() => this.contextChat()?.is_locked ?? false);
  readonly isChatMuted = computed(() => this.contextChat()?.is_muted ?? false);

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
    if (view === 'share') {
      this.reloadShareLinks();
    }
    if (view === 'webhooks') {
      this.reloadWebhooks();
      this.cancelWebhookForm();
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

  togglePin(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (this.isChatPinned()) {
      this.chatHttp.unpinChat(cid).subscribe({
        next: () => {
          this.toastService.show('Chat desfijado.', 'success');
          this.chatAction.emit({ chatId: cid, action: 'unpin' });
          this.close();
        },
        error: () => this.toastService.show('No se pudo desfijar el chat.', 'error'),
      });
    } else {
      this.chatHttp.pinChat(cid).subscribe({
        next: () => {
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

  revokeShareLink(linkId: number): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    if (!window.confirm('¿Revocar este enlace de compartir?')) return;
    this.chatHttp
      .revokeShareLink(cid, linkId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.shareLinks.update((links) => links.filter((l) => l.id !== linkId));
          this.toastService.show('Enlace revocado.', 'success');
        },
        error: () => this.toastService.show('No se pudo revocar el enlace.', 'error'),
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

  addParticipants(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const raw = window.prompt('IDs de miembro a agregar (separados por comas):');
    if (!raw?.trim()) return;
    const ids = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      this.toastService.show('No se ingresaron IDs válidos.', 'error');
      return;
    }
    this.chatHttp.addMembers(cid, { member_ids: ids }).subscribe({
      next: (added) => {
        this.toastService.show(`${added.length} participante(s) agregado(s).`, 'success');
        this.reloadMembers(cid);
      },
      error: () => this.toastService.show('No se pudieron agregar los participantes.', 'error'),
    });
  }

  changeRole(member: MembershipDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const roles: MembershipRole[] = ['owner', 'editor', 'reader'];
    const next = roles[(roles.indexOf(member.role) + 1) % roles.length];
    if (!window.confirm(`¿Cambiar rol de usuario ${member.member_id} a "${next}"?`)) return;
    this.chatHttp.patchMemberRole(cid, member.id, { role: next }).subscribe({
      next: (updated) => {
        this.toastService.show('Rol actualizado.', 'success');
        this.members.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      },
      error: () => this.toastService.show('No se pudo actualizar el rol.', 'error'),
    });
  }

  changeStatus(member: MembershipDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    const statuses: MembershipStatus[] = ['active', 'inactive', 'pending'];
    const next = statuses[(statuses.indexOf(member.status) + 1) % statuses.length];
    if (!window.confirm(`¿Cambiar estado de usuario ${member.member_id} a "${next}"?`)) return;
    this.chatHttp.patchMember(cid, member.id, { status: next }).subscribe({
      next: (updated) => {
        this.toastService.show('Estado actualizado.', 'success');
        this.members.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      },
      error: () => this.toastService.show('No se pudo actualizar el estado.', 'error'),
    });
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
