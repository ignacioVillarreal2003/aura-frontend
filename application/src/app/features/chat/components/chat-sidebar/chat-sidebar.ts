import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ChatOptionsDrawer } from '../chat-options-drawer/chat-options-drawer';
import type { ChatRef } from '../chat-options-drawer/chat-options-drawer';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import { NotificationState } from '@core/state/notification.state';
import { ChatService } from '@core/services/chat/chat.service';
import type { ChatListItemDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, ChatOptionsDrawer, RouterLink],
  templateUrl: './chat-sidebar.html',
  styleUrls: ['./chat-sidebar.css'],
})
export class ChatSidebar implements OnInit {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly chatService = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);
  readonly notifState = inject(NotificationState);

  readonly collapsed = input(false);
  readonly activeId = input<string | null>(null);

  readonly toggle = output<boolean>();
  readonly chatAction = output<{ chatId: string; action: string }>();

  readonly chats = signal<ChatListItemDto[]>([]);
  readonly sortedChats = computed(() =>
    [...this.chats()].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const at = a.last_message_at ?? a.created_at;
      const bt = b.last_message_at ?? b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    })
  );

  chatActionsDrawerOpen = signal(false);
  drawerContextChat = signal<ChatRef | null>(null);

  readonly loadingMore = signal(false);
  private nextUrl: string | null = null;

  ngOnInit(): void {
    this.reloadChats();
    this.chatService.sidebarReload$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadChats());
  }

  /** Id numérico del chat activo (la ruta lo expone como string), o null. */
  private activeChatId(): number | null {
    const raw = this.activeId();
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Limpia el indicador de no leídos localmente para un chat dado. */
  private clearUnreadFor(chatId: number): void {
    this.chats.update((list) =>
      list.map((c) => (c.id === chatId && c.unread_count > 0 ? { ...c, unread_count: 0 } : c)),
    );
  }

  /** Apenas se abre un chat, ocultá el punto rojo sin esperar al backend. */
  onChatClick(chatId: number): void {
    this.clearUnreadFor(chatId);
  }

  reloadChats(): void {
    this.nextUrl = null;
    this.chatHttp.listChats({ page_size: 15 }).subscribe({
      next: (page) => {
        this.chats.set([...page.results]);
        this.nextUrl = page.next;
        // El chat que estás viendo ya está leído: no dejes que una recarga
        // disparada antes de que el backend confirme reintroduzca el punto.
        const active = this.activeChatId();
        if (active != null) this.clearUnreadFor(active);
      },
      error: () => {
        this.chats.set([]);
        this.nextUrl = null;
        this.toastService.show('No se pudieron cargar los chats.', 'error');
      },
    });
  }

  private loadMoreChats(): void {
    if (!this.nextUrl || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.chatHttp.listChats({ url: this.nextUrl }).subscribe({
      next: (page) => {
        const existing = new Set(this.chats().map((c) => c.id));
        const fresh = page.results.filter((c) => !existing.has(c.id));
        this.chats.update((curr) => [...curr, ...fresh]);
        this.nextUrl = page.next;
        this.loadingMore.set(false);
        const active = this.activeChatId();
        if (active != null) this.clearUnreadFor(active);
      },
      error: () => {
        this.loadingMore.set(false);
      },
    });
  }

  onChatsScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      this.loadMoreChats();
    }
  }

  isOpen() {
    return !this.collapsed();
  }

  onOpenClose() {
    this.toggle.emit(!this.collapsed());
  }

  initials() {
    const n = this.auth.getSidebarUser().name?.trim?.() || 'U';
    // Separa por espacios y separadores de username (. _ -): "ten.lopez" → "TL".
    const parts = n.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  username() {
    return this.auth.getSidebarUser().name ?? '';
  }

  onChatOptionsClick(event: MouseEvent, chatId: number) {
    event.stopPropagation();
    const row = this.chats().find((c) => c.id === chatId);
    if (!row) return;
    this.drawerContextChat.set({
      id: row.id,
      name: row.name,
      is_pinned: row.is_pinned,
      archived_at: row.archived_at,
      is_locked: row.is_locked,
      tags: row.tags ?? [],
    });
    this.chatActionsDrawerOpen.set(true);
  }

  onChatActionsDrawerChange(open: boolean): void {
    this.chatActionsDrawerOpen.set(open);
    if (!open) {
      this.drawerContextChat.set(null);
    }
  }

  onChatUpdated(_event: { chatId: number; name?: string; system_prompt?: string | null; response_style?: string | null }): void {
    this.reloadChats();
  }

  onDrawerChatAction(data: { chatId: number; action: string; tags?: readonly string[] }): void {
    const id = data.chatId;
    if (!Number.isFinite(id)) return;

    this.drawerContextChat.update((c) => {
      if (!c || c.id !== data.chatId) return c;
      switch (data.action) {
        case 'pin':       return { ...c, is_pinned: true };
        case 'unpin':     return { ...c, is_pinned: false };
        case 'lock':      return { ...c, is_locked: true };
        case 'unlock':    return { ...c, is_locked: false };
        case 'archive':      return { ...c, archived_at: new Date().toISOString() };
        case 'unarchive':    return { ...c, archived_at: null };
        case 'tags-updated': return { ...c, tags: data.tags ?? c.tags };
        default:             return c;
      }
    });

    const navigateAwayActions = new Set(['leave', 'archive']);
    const reloadActions = new Set(['leave', 'archive', 'unarchive', 'pin', 'unpin', 'lock', 'unlock', 'tags-updated']);

    if (reloadActions.has(data.action)) {
      this.reloadChats();
      if (navigateAwayActions.has(data.action)) {
        const url = this.router.url.split('?')[0];
        if (url.includes(`/main-container/chat/${id}`)) {
          void this.router.navigate(['/main-container', 'chat-home']);
        }
      }
      return;
    }

    this.chatAction.emit({ chatId: String(id), action: data.action });
  }
}
