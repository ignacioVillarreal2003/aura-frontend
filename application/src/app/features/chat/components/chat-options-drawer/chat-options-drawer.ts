import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraAuthServiceHttp } from '@core/services/http-services/aura-auth-service-http.service';
import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { UserState } from '@core/state/user.state';
import { UserCacheService } from '@core/services/user-cache.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ChatWebSocketService, type ChatSocketConnection } from '@core/services/websocket/chat-websocket.service';
import type { UserLookupDto } from '@aura-types/aura-auth-service.types';
import {
  type ArtifactSummaryDto,
  type AuraChatWsServerMessage,
  type PeerMessageDto,
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
  readonly tags: readonly string[];
  readonly system_prompt?: string | null;
  readonly response_style?: string | null;
}

interface ConfirmOpts {
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly onConfirm: () => void;
}

export interface DocumentItem {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly created_at: string;
}

type PanelView = 'root' | 'documents' | 'participants' | 'add-participants' | 'chat' | 'team-chat' | 'share' | 'pinned' | 'bookmarks' | 'export' | 'artifacts' | 'reports' | 'checklists' | 'rename' | 'tags' | 'prompts';

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
  imports: [CommonModule],
  templateUrl: './chat-options-drawer.html',
  styleUrl: './chat-options-drawer.css',
  host: {
    '[class.open]': 'isOpen()',
    '(document:click)': 'onDocumentClick()',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class ChatOptionsDrawer {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly authHttp = inject(AuraAuthServiceHttp);
  private readonly docHttp = inject(AuraDocumentProcessingServiceHttp);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly userState = inject(UserState);
  private readonly userCache = inject(UserCacheService);
  private readonly auth = inject(AuthenticationService);
  private readonly wsFactory = inject(ChatWebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _userSearch$ = new Subject<string>();

  readonly canListReports = computed(() =>
    this.userState.user()?.permissions.includes('LIST_REPORTS') ?? false
  );
  readonly canListChecklists = computed(() =>
    this.userState.user()?.permissions.includes('LIST_CHECKLISTS') ?? false
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
  readonly chatMetaUpdated = output<{ chatId: number; name?: string; system_prompt?: string | null; response_style?: string | null }>();

  // Resets to 'root' when the drawer closes; preserves the user's navigation
  // while it stays open. Writable, so set(...) for navigation still works.
  readonly panelView = linkedSignal<boolean, PanelView>({
    source: this.isOpen,
    computation: (open, prev) => (open ? (prev?.value ?? 'root') : 'root'),
  });
  readonly members = signal<MembershipDto[]>([]);
  readonly membersLoading = signal(false);
  readonly memberUserMap = signal<Map<number, UserLookupDto>>(new Map());
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
  readonly downloadingArtifactId = signal<number | null>(null);

  readonly reports = signal<ReportListItemDto[]>([]);
  readonly reportsLoading = signal(false);
  readonly reportsPage = signal(1);
  readonly reportsHasNext = signal(false);
  readonly reportsHasPrev = signal(false);
  readonly reportsTotalCount = signal(0);
  private readonly reportsPageSize = 8;
  readonly exportingItemId = signal<number | null>(null);

  readonly pendingConfirm = linkedSignal<boolean, ConfirmOpts | null>({
    source: this.isOpen,
    computation: (open, prev) => (open ? (prev?.value ?? null) : null),
  });

  readonly checklists = signal<ChecklistListItemDto[]>([]);
  readonly checklistsLoading = signal(false);
  readonly checklistsPage = signal(1);
  readonly checklistsHasNext = signal(false);
  readonly checklistsHasPrev = signal(false);
  readonly checklistsTotalCount = signal(0);
  private readonly checklistsPageSize = 8;
  readonly renameValue = signal('');
  readonly renameSubmitting = signal(false);
  readonly promptSystemPrompt = signal('');
  readonly promptResponseStyle = signal('');
  readonly promptSubmitting = signal(false);
  readonly tagsInput = signal('');
  readonly tagsDraft = signal<string[]>([]);
  readonly tagsSubmitting = signal(false);
  readonly userSearchQuery = signal('');
  readonly userSearchResults = signal<UserLookupDto[]>([]);
  readonly userSearchLoading = signal(false);
  readonly userSearchOpen = signal(false);
  readonly selectedUsers = signal<UserLookupDto[]>([]);
  readonly inviting = signal(false);

  // ── Team chat (human-to-human, no AI) ──────────────────────────────────────
  readonly peerMessages = signal<PeerMessageDto[]>([]);
  readonly peerLoading = signal(false);
  readonly peerInput = signal('');
  readonly editingPeerId = signal<number | null>(null);
  readonly editingPeerText = signal('');
  readonly peerTypingIds = signal<number[]>([]);
  private peerConn: ChatSocketConnection | null = null;
  private peerSub: Subscription | null = null;
  private peerTypingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private peerSelfTypingTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUserId = computed(() => this.userState.user()?.id ?? null);
  readonly isPeerChatOwner = computed(() => {
    const uid = this.currentUserId();
    if (uid == null) return false;
    return this.members().some((m) => m.member_id === uid && m.role === 'owner');
  });

  readonly headerTitle = computed(() => {
    switch (this.panelView()) {
      case 'add-participants': return 'Añadir participantes';
      case 'chat': return 'Gestionar chat';
      case 'team-chat': return 'Chat del equipo';
      case 'participants': return 'Participantes';
      case 'documents': return 'Documentos';
      case 'share': return 'Compartir';
      case 'pinned': return 'Mensajes fijados';
      case 'bookmarks': return 'Guardados';
      case 'export': return 'Exportar chat';
      case 'artifacts': return 'Artefactos';
      case 'reports': return 'Informes';
      case 'checklists': return 'Checklists';
      case 'rename': return 'Cambiar nombre';
      case 'tags': return 'Etiquetas';
      case 'prompts': return 'Prompts';
      default: return this.panelTitle();
    }
  });

  readonly contextChatId = computed(() => this.contextChat()?.id ?? null);
  readonly contextChatTitle = computed(() => this.contextChat()?.name ?? '');

  // Writable state derived from the active chat: resets to the source's
  // is_pinned when switching chats, but preserves the user's manual pin/unpin
  // while staying on the same chat.
  private readonly _pinned = linkedSignal<ChatRef | null, boolean>({
    source: this.contextChat,
    computation: (chat, previous) => {
      if (previous && (chat?.id ?? null) === (previous.source?.id ?? null)) {
        return previous.value;
      }
      return chat?.is_pinned ?? false;
    },
  });
  readonly isChatPinned = computed(() => this._pinned());

  readonly isChatArchived = computed(() => this.contextChat()?.archived_at != null);
  readonly isChatLocked = computed(() => this.contextChat()?.is_locked ?? false);

  readonly mergedDocuments = computed((): DocumentItem[] => {
    const byId = new Map<number, DocumentItem>();
    for (const doc of this.fetchedDocuments()) byId.set(doc.id, doc);
    for (const doc of this.attachedDocuments()) byId.set(doc.id, doc);
    return [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  constructor() {
    this._userSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 1) {
          this.userSearchResults.set([]);
          this.userSearchLoading.set(false);
          return [];
        }
        this.userSearchLoading.set(true);
        return this.authHttp.lookupUsers(q.trim());
      }),
    ).subscribe({
      next: (res) => {
        this.userSearchResults.set([...res.results]);
        this.userSearchLoading.set(false);
        this.userSearchOpen.set(true);
      },
      error: () => {
        this.userSearchLoading.set(false);
      },
    });

    // Tear down the team-chat socket whenever we leave that panel (back, close,
    // or the drawer resetting panelView to 'root').
    effect(() => {
      if (this.panelView() !== 'team-chat' && this.peerConn) {
        this.closePeerChat();
      }
    });

    this.destroyRef.onDestroy(() => this.closePeerChat());
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
    if (view === 'team-chat') {
      this.openPeerChat();
    }
    if (view === 'share') {
      this.reloadShareLinks();
    }
    if (view === 'rename') {
      this.renameValue.set(this.contextChatTitle()?.trim() ?? '');
      this.renameSubmitting.set(false);
    }
    if (view === 'add-participants') {
      this.userSearchQuery.set('');
      this.userSearchResults.set([]);
      this.userSearchOpen.set(false);
      this.selectedUsers.set([]);
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
    if (view === 'prompts') {
      const chat = this.contextChat();
      this.promptSystemPrompt.set(chat?.system_prompt ?? '');
      this.promptResponseStyle.set(chat?.response_style ?? '');
      this.promptSubmitting.set(false);
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
      confirmLabel: 'Eliminar documento',
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

  submitPrompts(): void {
    const cid = this.contextChatId();
    if (cid == null || this.promptSubmitting()) return;
    this.promptSubmitting.set(true);
    this.chatHttp.patchChat(cid, {
      system_prompt: this.promptSystemPrompt().trim() || null,
      response_style: this.promptResponseStyle().trim() || null,
    }).subscribe({
      next: () => {
        this.toastService.show('Prompts actualizados.', 'success');
        const sp = this.promptSystemPrompt().trim() || null;
        const rs = this.promptResponseStyle().trim() || null;
        this.chatMetaUpdated.emit({ chatId: cid, system_prompt: sp, response_style: rs });
        this.promptSubmitting.set(false);
        this.goRoot();
      },
      error: () => {
        this.toastService.show('No se pudieron guardar los prompts.', 'error');
        this.promptSubmitting.set(false);
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
      confirmLabel: 'Eliminar conversación',
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
      confirmLabel: 'Salir del chat',
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

  onSearchInput(query: string): void {
    this.userSearchQuery.set(query);
    if (query.trim().length < 1) {
      this.userSearchResults.set([]);
      this.userSearchOpen.set(false);
    }
    this._userSearch$.next(query);
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUsers().some((u) => u.id === userId);
  }

  selectUser(user: UserLookupDto): void {
    if (this.isUserSelected(user.id)) return;
    this.selectedUsers.update((list) => [...list, user]);
    this.userSearchQuery.set('');
    this.userSearchResults.set([]);
    this.userSearchOpen.set(false);
  }

  removeSelectedUser(userId: number): void {
    this.selectedUsers.update((list) => list.filter((u) => u.id !== userId));
  }

  userInitials(name: string): string {
    // Separa por espacios y separadores de username (. _ -): "ten.lopez" → "TL".
    const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  closeUserSearch(): void {
    this.userSearchOpen.set(false);
  }

  submitInvite(): void {
    const cid = this.contextChatId();
    const users = this.selectedUsers();
    if (cid == null || users.length === 0) return;
    this.inviting.set(true);
    this.chatHttp.addMembers(cid, { member_ids: users.map((u) => u.id) }).subscribe({
      next: (added) => {
        this.toastService.show(`${added.length} participante(s) invitado(s).`, 'success');
        this.inviting.set(false);
        this.selectedUsers.set([]);
        this.panelView.set('participants');
        this.reloadMembers(cid);
      },
      error: () => {
        this.toastService.show('No se pudieron agregar los participantes.', 'error');
        this.inviting.set(false);
      },
    });
  }

  // ── Team chat (human-to-human, no AI) ──────────────────────────────────────
  readonly peerTypingLabel = computed(() => {
    const ids = this.peerTypingIds();
    if (ids.length === 0) return '';
    if (ids.length === 1) return `${this.peerAuthorName(ids[0])} está escribiendo…`;
    return 'Varios están escribiendo…';
  });

  private openPeerChat(): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.closePeerChat();
    // Reuse the member list to resolve author names and detect the chat owner.
    this.reloadMembers(cid);
    this.loadPeerHistory(cid);
    // Refrescá el token si está por vencer antes de abrir el WS (lo toma una sola
    // vez y no pasa por el interceptor). Cubre el caso de actividad sólo-WS.
    this.auth.ensureFreshToken()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => {
        if (this.contextChatId() !== cid) return;
        const conn = this.wsFactory.open(cid, token);
        if (!conn) {
          this.toastService.show('No se pudo conectar al chat en tiempo real.', 'error');
          return;
        }
        this.peerConn = conn;
        this.peerSub = conn.messages$.subscribe({
          next: (msg) => this.handlePeerEvent(msg),
        });
      });
  }

  private closePeerChat(): void {
    this.peerSub?.unsubscribe();
    this.peerSub = null;
    this.peerConn?.close();
    this.peerConn = null;
    for (const t of this.peerTypingTimers.values()) clearTimeout(t);
    this.peerTypingTimers.clear();
    if (this.peerSelfTypingTimer) {
      clearTimeout(this.peerSelfTypingTimer);
      this.peerSelfTypingTimer = null;
    }
    this.peerTypingIds.set([]);
    this.peerMessages.set([]);
    this.peerInput.set('');
    this.cancelEditPeer();
    this.peerLoading.set(false);
  }

  private loadPeerHistory(chatId: number): void {
    this.peerLoading.set(true);
    this.peerMessages.set([]);
    this.chatHttp.listPeerMessages(chatId, { page_size: 50 }).pipe(take(1)).subscribe({
      next: (page) => {
        // Server returns newest-first; render oldest-first like a chat log.
        this.peerMessages.set([...page.results].reverse());
        this.peerLoading.set(false);
      },
      error: () => {
        this.peerLoading.set(false);
        this.toastService.show('No se pudieron cargar los mensajes.', 'error');
      },
    });
  }

  private handlePeerEvent(msg: AuraChatWsServerMessage): void {
    switch (msg.type) {
      case 'peer_message_created': {
        const dto: PeerMessageDto = {
          id: msg.id, chat_id: msg.chat_id, message: msg.message,
          created_by: msg.created_by, created_at: msg.created_at,
          updated_at: msg.updated_at, is_edited: msg.is_edited,
        };
        this.peerMessages.update((list) =>
          list.some((m) => m.id === dto.id) ? list : [...list, dto]
        );
        this.markPeerTyping(dto.created_by, false);
        break;
      }
      case 'peer_message_updated': {
        const dto: PeerMessageDto = {
          id: msg.id, chat_id: msg.chat_id, message: msg.message,
          created_by: msg.created_by, created_at: msg.created_at,
          updated_at: msg.updated_at, is_edited: msg.is_edited,
        };
        this.peerMessages.update((list) => list.map((m) => (m.id === dto.id ? dto : m)));
        break;
      }
      case 'peer_message_deleted': {
        this.peerMessages.update((list) => list.filter((m) => m.id !== msg.id));
        if (this.editingPeerId() === msg.id) this.cancelEditPeer();
        break;
      }
      case 'peer_typing': {
        this.markPeerTyping(msg.user_id, msg.is_typing);
        break;
      }
      case 'error': {
        this.toastService.show(msg.detail || 'Error en el chat.', 'error');
        break;
      }
    }
  }

  sendPeer(): void {
    const text = this.peerInput().trim();
    if (!this.peerConn || !text) return;
    this.peerConn.sendPeerMessage(text);
    this.peerInput.set('');
    this.notifyPeerTypingStopped();
  }

  onPeerInput(value: string): void {
    this.peerInput.set(value);
    if (!this.peerConn) return;
    this.peerConn.sendPeerTyping(true);
    if (this.peerSelfTypingTimer) clearTimeout(this.peerSelfTypingTimer);
    this.peerSelfTypingTimer = setTimeout(() => this.notifyPeerTypingStopped(), 2500);
  }

  private notifyPeerTypingStopped(): void {
    if (this.peerSelfTypingTimer) {
      clearTimeout(this.peerSelfTypingTimer);
      this.peerSelfTypingTimer = null;
    }
    this.peerConn?.sendPeerTyping(false);
  }

  startEditPeer(m: PeerMessageDto): void {
    this.editingPeerId.set(m.id);
    this.editingPeerText.set(m.message);
  }

  cancelEditPeer(): void {
    this.editingPeerId.set(null);
    this.editingPeerText.set('');
  }

  submitEditPeer(): void {
    const id = this.editingPeerId();
    const text = this.editingPeerText().trim();
    if (id == null || !text || !this.peerConn) return;
    this.peerConn.editPeerMessage(id, text);
    this.cancelEditPeer();
  }

  deletePeer(m: PeerMessageDto): void {
    this.requestConfirm({
      title: '¿Eliminar este mensaje?',
      confirmLabel: 'Eliminar',
      onConfirm: () => this.peerConn?.deletePeerMessage(m.id),
    });
  }

  isOwnPeer(m: PeerMessageDto): boolean {
    return m.created_by === this.currentUserId();
  }

  canEditPeer(m: PeerMessageDto): boolean {
    return this.isOwnPeer(m);
  }

  canDeletePeer(m: PeerMessageDto): boolean {
    return this.isOwnPeer(m) || this.isPeerChatOwner();
  }

  peerAuthorName(userId: number): string {
    const u = this.memberUserMap().get(userId);
    if (u) return u.name?.trim() || `@${u.username}`;
    if (userId === this.currentUserId()) return 'Vos';
    return `Usuario ${userId}`;
  }

  peerAuthorInitials(userId: number): string {
    const u = this.memberUserMap().get(userId);
    const base = (u?.name?.trim() || u?.username || `U${userId}`).toUpperCase();
    const parts = base.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
    return base.slice(0, 2);
  }

  private markPeerTyping(userId: number, isTyping: boolean): void {
    if (userId === this.currentUserId()) return;
    const existing = this.peerTypingTimers.get(userId);
    if (existing) clearTimeout(existing);
    if (!isTyping) {
      this.peerTypingTimers.delete(userId);
      this.peerTypingIds.update((ids) => ids.filter((i) => i !== userId));
      return;
    }
    this.peerTypingIds.update((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
    this.peerTypingTimers.set(
      userId,
      setTimeout(() => this.markPeerTyping(userId, false), 4000),
    );
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

  docStatusLabel(status: string): string {
    switch (status) {
      case 'uploaded':   return 'Procesando';
      case 'processed':  return 'Listo';
      case 'failed':     return 'Error';
      default:           return status;
    }
  }

  removeMember(row: MembershipDto): void {
    const cid = this.contextChatId();
    if (cid == null) return;
    this.requestConfirm({
      title: '¿Quitar a este participante?',
      confirmLabel: 'Quitar participante',
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
      confirmLabel: 'Limpiar historial',
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

  /** Resolve the PDF export observable for any artifact summary (pinned or bookmarked). */
  private artifactPdfObservable(artifact: ArtifactSummaryDto): Observable<Blob> | null {
    const lid = artifact.linked_id;
    switch (artifact.type) {
      case 'MESSAGE': {
        const msgId = artifact.message?.id ?? artifact.id;
        return this.chatHttp.exportArtifactMessagePdf(msgId);
      }
      case 'REPORT':           return lid ? this.chatHttp.exportReportPdf(lid) : null;
      case 'CHECKLIST':        return lid ? this.chatHttp.exportChecklistPdf(lid) : null;
      case 'QUIZ':             return lid ? this.chatHttp.exportQuizPdf(lid) : null;
      case 'TIMELINE':         return lid ? this.chatHttp.exportTimelinePdf(lid) : null;
      case 'LESSONS_LEARNED':  return lid ? this.chatHttp.exportLessonsLearnedPdf(lid) : null;
      case 'DECISION_BRIEF':   return lid ? this.chatHttp.exportDecisionBriefPdf(lid) : null;
      case 'DOCUMENT_SUMMARY': return lid ? this.chatHttp.exportDocumentSummaryPdf(lid) : null;
      case 'DOCUMENT_ACTION':  return lid ? this.chatHttp.exportDocumentActionPdf(lid) : null;
      default:                 return null;
    }
  }

  downloadArtifact(artifact: ArtifactSummaryDto): void {
    if (this.downloadingArtifactId() !== null) return;
    const obs$ = this.artifactPdfObservable(artifact);
    if (!obs$) {
      this.toastService.show('No se puede descargar este elemento.', 'error');
      return;
    }
    this.downloadingArtifactId.set(artifact.id);
    const base = (artifact.message?.message ?? artifact.title ?? `mensaje-${artifact.id}`)
      .replace(/\s+/g, ' ').trim().replace(/[^\w-]/g, '_').slice(0, 60) || `mensaje-${artifact.id}`;
    obs$.pipe(take(1)).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `${base}.pdf`);
        this.downloadingArtifactId.set(null);
      },
      error: () => {
        this.downloadingArtifactId.set(null);
        this.toastService.show('No se pudo descargar.', 'error');
      },
    });
  }

  reloadMembers(chatId: number): void {
    this.membersLoading.set(true);
    this.chatHttp
      .listMembers(chatId, { page_size: 100, status: 'all' })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          const list = [...page.results];
          this.members.set(list);
          this.membersLoading.set(false);
          const ids = [...new Set(list.map((m) => m.member_id))];
          if (ids.length > 0) {
            this.userCache.resolve(ids).pipe(take(1)).subscribe({
              next: (userMap) => this.memberUserMap.set(userMap),
            });
          }
        },
        error: () => {
          this.membersLoading.set(false);
          this.toastService.show('No se pudieron cargar los participantes.', 'error');
        },
      });
  }

  memberDisplayName(member: MembershipDto): string {
    const u = this.memberUserMap().get(member.member_id);
    if (u) {
      const name = u.name?.trim();
      return name ? `${name} · @${u.username}` : `@${u.username}`;
    }
    return `@usuario ${member.member_id}`;
  }

  memberInitials(member: MembershipDto): string {
    const u = this.memberUserMap().get(member.member_id);
    if (u) {
      const name = (u.name?.trim() || u.username).toUpperCase();
      const parts = name.split(/[\s._-]+/).filter(Boolean);
      if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
      return name.slice(0, 2);
    }
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const id = member.member_id;
    return alphabet[id % alphabet.length] + alphabet[(id * 17) % alphabet.length];
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
    void this.router.navigate(['/', route, item.id]);
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
    void this.router.navigate(['/', 'report', reportId]);
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
      confirmLabel: 'Eliminar informe',
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
    void this.router.navigate(['/', 'checklist', checklistId]);
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
      confirmLabel: 'Eliminar checklist',
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

  onDocumentClick(): void {
    if (this.userSearchOpen()) this.userSearchOpen.set(false);
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.userSearchOpen()) {
        this.userSearchOpen.set(false);
        return;
      }
      if (this.isOpen()) {
        if (this.panelView() !== 'root') {
          this.goRoot();
        } else {
          this.close();
        }
      }
    }
  }
}
