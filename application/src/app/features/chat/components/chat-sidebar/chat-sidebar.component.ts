import { Component, EventEmitter, Input, Output, signal, OnInit, inject, ElementRef, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { ChatOptionsDrawerComponent } from '../chat-options-drawer/chat-options-drawer';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { ToastService } from '@core/components/toast-service';

type ChatRow = { id: string; title: string };

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon, ChatOptionsDrawerComponent, RouterLink],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.css'],
})
export class ChatSidebarComponent implements OnInit {
  private readonly api = inject(AuraChatApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() userEmailInput = 'usuario@ejemplo.com';
  @Input() userNameInput = 'Emiliano Fau';
  @Input() userRolInput = 'Operador';

  @Output() toggle = new EventEmitter<boolean>();
  @Output() chatAction = new EventEmitter<{ chatId: string; action: string }>();

  chats: ChatRow[] = [];

  chatActionsDrawerOpen = signal(false);
  drawerChatId = signal<string | null>(null);
  drawerChatTitle = signal('');

  renamingChatId = signal<string | null>(null);
  renameValue = signal('');

  private readonly renameInputs = viewChildren<ElementRef<HTMLInputElement>>('renameInput');

  ngOnInit(): void {
    this.reloadChats();
  }

  reloadChats(): void {
    this.api.listMyChats({ page_size: 50 }).subscribe({
      next: (page) => {
        this.chats = page.data.map((s) => ({
          id: String(s.id),
          title: s.name,
        }));
      },
      error: () => {
        this.chats = [];
        this.toast.show('No se pudieron cargar los chats.', 'error');
      },
    });
  }

  isOpen() {
    return !this.collapsed;
  }
  onOpenClose() {
    this.toggle.emit(!this.collapsed);
  }

  userInitials() {
    const n = this.userNameInput?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  userName() {
    return this.userNameInput;
  }
  userRol() {
    return this.userRolInput;
  }

  onChatOptionsClick(event: MouseEvent, chatId: string) {
    event.stopPropagation();
    const row = this.chats.find((c) => c.id === chatId);
    if (!row) return;
    this.drawerChatId.set(chatId);
    this.drawerChatTitle.set(row.title);
    this.chatActionsDrawerOpen.set(true);
  }

  onChatActionsDrawerChange(open: boolean): void {
    this.chatActionsDrawerOpen.set(open);
    if (!open) {
      this.drawerChatId.set(null);
      this.drawerChatTitle.set('');
    }
  }

  onDrawerMenuAction(data: { chatId: string; action: string }): void {
    const id = Number.parseInt(data.chatId, 10);
    if (!Number.isFinite(id)) {
      return;
    }
    if (data.action === 'delete') {
      if (!window.confirm('¿Eliminar esta conversación?')) {
        return;
      }
      this.api.deleteChat(id).subscribe({
        next: () => {
          this.toast.show('Chat eliminado.', 'success');
          this.reloadChats();
          const url = this.router.url.split('?')[0];
          if (url.includes(`/main-container/chat/${data.chatId}`)) {
            void this.router.navigate(['/main-container', 'chat-home']);
          }
        },
        error: () => this.toast.show('No se pudo eliminar el chat.', 'error'),
      });
      return;
    }
    if (data.action === 'archive') {
      this.api.archiveChat(id).subscribe({
        next: () => {
          this.toast.show('Chat archivado.', 'success');
          this.reloadChats();
          const url = this.router.url.split('?')[0];
          if (url.includes(`/main-container/chat/${data.chatId}`)) {
            void this.router.navigate(['/main-container', 'chat-home']);
          }
        },
        error: () => this.toast.show('No se pudo archivar el chat.', 'error'),
      });
      return;
    }
    if (data.action === 'rename') {
      const row = this.chats.find((c) => c.id === data.chatId);
      if (!row) return;
      this.renamingChatId.set(data.chatId);
      this.renameValue.set(row.title);
      setTimeout(() => {
        const input = this.renameInputs().find(
          (el) => el.nativeElement.dataset['chatId'] === data.chatId
        );
        input?.nativeElement.focus();
        input?.nativeElement.select();
      });
      return;
    }
    this.chatAction.emit(data);
  }

  onRenameKeydown(event: KeyboardEvent, chatId: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.commitRename(chatId);
    } else if (event.key === 'Escape') {
      this.renamingChatId.set(null);
    }
  }

  onRenameBlur(chatId: string): void {
    if (this.renamingChatId() === chatId) {
      void this.commitRename(chatId);
    }
  }

  private commitRename(chatId: string): void {
    const newName = this.renameValue().trim();
    const row = this.chats.find((c) => c.id === chatId);
    this.renamingChatId.set(null);
    if (!newName || newName === row?.title) return;
    const id = Number.parseInt(chatId, 10);
    this.api.patchChat(id, { name: newName }).subscribe({
      next: () => {
        this.toast.show('Chat renombrado.', 'success');
        this.reloadChats();
      },
      error: () => this.toast.show('No se pudo renombrar el chat.', 'error'),
    });
  }
}
