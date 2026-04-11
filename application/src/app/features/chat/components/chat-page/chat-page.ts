import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatSidebarComponent } from '../chat-sidebar/chat-sidebar.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ChatSidebarComponent],
  templateUrl: './chat-page.html',
  styleUrls: ['./chat-page.css'],
})
export class ChatPageComponent {
  private router = inject(Router);

  collapsed = signal(false);
  activeId = signal<string | null>('new-chat');

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncActiveFromUrl());
    this.syncActiveFromUrl();
  }

  onSelect(id: string) {
    if (id === 'profile') {
      void this.router.navigate(['/user']);
      return;
    }
    if (id === 'tools') {
      this.activeId.set('tools');
      return;
    }
    if (id === 'chats' || id === 'search') {
      void this.router.navigate(['/main-container/chats']);
      return;
    }
    this.activeId.set(id);
  }

  onChatSelect(data: { id: string; isGroup: boolean }) {
    void this.router.navigate(['/main-container/chat', data.id]);
  }

  onNewChat() {
    void this.router.navigate(['/main-container/new-chat']);
  }

  onChatAction(data: { chatId: string; action: string }) {
    console.log('Acción de chat:', data);
  }

  private syncActiveFromUrl(): void {
    const url = this.router.url.split('?')[0];
    if (url.includes('/main-container/chats')) {
      this.activeId.set('chats');
      return;
    }
    if (url.includes('/main-container/new-chat')) {
      this.activeId.set('new-chat');
      return;
    }
    const m = url.match(/\/main-container\/chat\/([^/]+)/);
    if (m?.[1]) {
      this.activeId.set(m[1]);
      return;
    }
    if (url === '/main-container' || url.endsWith('/main-container')) {
      this.activeId.set('new-chat');
    }
  }
}
