import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
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
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.css'],
})
export class ChatSidebarComponent implements OnInit {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly chatService = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);
  readonly notifState = inject(NotificationState);

  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Output() toggle = new EventEmitter<boolean>();
  @Output() chatAction = new EventEmitter<{ chatId: string; action: string }>();

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

  ngOnInit(): void {
    this.reloadChats();
    this.chatService.sidebarReload$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadChats());
  }

  reloadChats(): void {
    this.chatHttp.listChats({ page_size: 50 }).subscribe({
      next: (page) => {
        this.chats.set([...page.results]);
      },
      error: () => {
        this.chats.set([]);
        this.toastService.show('No se pudieron cargar los chats.', 'error');
      },
    });
  }

  isOpen() {
    return !this.collapsed;
  }

  onOpenClose() {
    this.toggle.emit(!this.collapsed);
  }

  initials() {
    const n = this.auth.getSidebarUser().name?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
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
      is_muted: row.is_muted,
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

  onChatUpdated(_event: { chatId: number; name: string }): void {
    this.reloadChats();
  }

  onDrawerChatAction(data: { chatId: number; action: string; tags?: readonly string[] }): void {
    const id = data.chatId;
    if (!Number.isFinite(id)) return;

    this.drawerContextChat.update((c) => {
      if (!c || c.id !== data.chatId) return c;
      switch (data.action) {
        case 'mute':      return { ...c, is_muted: true };
        case 'unmute':    return { ...c, is_muted: false };
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
    const reloadActions = new Set(['leave', 'archive', 'unarchive', 'pin', 'unpin', 'lock', 'unlock', 'mute', 'unmute', 'tags-updated']);

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
