import { Component, DestroyRef, signal, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatSidebarComponent } from '../components/chat-sidebar/chat-sidebar.component';
import { NotificationSseService } from '@core/services/notification/notification-sse.service';
import { NotificationState } from '@core/state/notification.state';
import { AuraNotificationServiceHttp } from '@core/services/http-services/aura-notification-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { NotificationDto } from '@core/types/aura-notification-service.types';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ChatSidebarComponent],
  templateUrl: './chat-page.html',
  styleUrls: ['./chat-page.css'],
})
export class ChatPageComponent {
  private readonly router = inject(Router);
  private readonly chatSidebar = viewChild<ChatSidebarComponent>('chatSidebar');
  private readonly sse = inject(NotificationSseService);
  private readonly notifState = inject(NotificationState);
  private readonly notifHttp = inject(AuraNotificationServiceHttp);
  private readonly toast = inject(ToastService);

  collapsed = signal(false);
  activeId = signal<string | null>('chat-home');

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.syncActiveFromUrl();
        const url = e.urlAfterRedirects.split('?')[0];
        if (url.includes('/main-container/chat-home') || url.match(/\/main-container\/chat\/[^/]+/)) {
          this.chatSidebar()?.reloadChats();
        }
      });

    this.syncActiveFromUrl();

    // Start SSE and load initial unread count
    this.sse.connect();
    this.notifHttp.getUnreadCount().subscribe({
      next: res => this.notifState.setUnreadCount(res.count),
    });

    // Show toast on incoming notifications
    this.sse.events$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.type === 'notification.created') {
        const n = event.data as NotificationDto;
        const text = n.title ? `${n.title}: ${n.message}` : n.message;
        this.toast.show(text.length > 80 ? text.slice(0, 80) + '…' : text, 'success');
        this.notifState.increment();
      }
    });

    destroyRef.onDestroy(() => this.sse.disconnect());
  }

  onChatAction(_data: { chatId: string; action: string }) {}

  private syncActiveFromUrl(): void {
    const url = this.router.url.split('?')[0];
    if (url.includes('/main-container/chats')) {
      this.activeId.set('chats');
      return;
    }
    if (url.includes('/main-container/tools')) {
      this.activeId.set('tools');
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
