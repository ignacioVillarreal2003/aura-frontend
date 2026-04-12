import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatSidebarComponent } from '../components/chat-sidebar/chat-sidebar.component';

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
  activeId = signal<string | null>('chat-home');

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncActiveFromUrl());
    this.syncActiveFromUrl();
  }

  onChatAction(data: { chatId: string; action: string }) {
    console.log('Acción de chat:', data);
  }

  private syncActiveFromUrl(): void {
    const url = this.router.url.split('?')[0];
    if (url.startsWith('/user')) {
      this.activeId.set('profile');
      return;
    }
    if (url.includes('/main-container/chats')) {
      this.activeId.set('chats');
      return;
    }
    if (url.includes('/main-container/chat-home')) {
      this.activeId.set('chat-home');
      return;
    }
    const m = url.match(/\/main-container\/chat\/([^/]+)/);
    if (m?.[1]) {
      this.activeId.set(m[1]);
      return;
    }
    if (url === '/main-container' || url.endsWith('/main-container')) {
      this.activeId.set('chat-home');
    }
  }
}
