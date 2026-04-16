import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {ChatOptionsDrawer} from '../chat-options-drawer/chat-options-drawer';
import {ChatHttpService} from '@core/services/http/chat-http.service';
import {ToastService} from '@core/components/toast-service';
import type {Chat, User} from '@core/models/types/chat.types';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, ChatOptionsDrawer, RouterLink],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.css'],
})
export class ChatSidebarComponent implements OnInit {
  private readonly chatHttpService = inject(ChatHttpService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() user: User = {
    name: 'Emiliano Fau',
    email: 'usuario@ejemplo.com',
    member_id: null
  };

  @Output() toggle = new EventEmitter<boolean>();
  @Output() chatAction = new EventEmitter<{ chatId: string; action: string }>();

  chats: Chat[] = [];

  chatActionsDrawerOpen = signal(false);
  drawerContextChat = signal<Chat | null>(null);

  ngOnInit(): void {
    this.reloadChats();
  }

  reloadChats(): void {
    this.chatHttpService.listMyChats({page_size: 50}).subscribe({
      next: (page) => {
        this.chats = page.data.map((s) => ({
          id: s.id,
          name: s.name,
        }));
      },
      error: () => {
        this.chats = [];
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
    const n = this.user?.name?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  username() {
    return this.user?.name ?? '';
  }

  onChatOptionsClick(event: MouseEvent, chatId: number) {
    event.stopPropagation();
    const row = this.chats.find((c) => c.id === chatId);
    if (!row) return;
    this.drawerContextChat.set(row);
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

  onDrawerChatAction(data: { chatId: number; action: string }): void {
    const id = data.chatId;
    if (!Number.isFinite(id)) return;

    if (data.action === 'leave') {
      this.reloadChats();
      const url = this.router.url.split('?')[0];
      if (url.includes(`/main-container/chat/${id}`)) {
        void this.router.navigate(['/main-container', 'chat-home']);
      }
      return;
    }

    this.chatAction.emit({chatId: String(id), action: data.action});
  }
}
