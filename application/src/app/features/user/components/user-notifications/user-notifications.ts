import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuraNotificationServiceHttp } from '@core/services/http-services/aura-notification-service-http.service';
import { NotificationSseService } from '@core/services/notification/notification-sse.service';
import { NotificationState } from '@core/state/notification.state';
import { ToastService } from '@core/components/toast-service';
import type {
  EventTypeCatalogueEntryDto,
  NotificationDto,
  NotificationPreferenceDto,
  NotificationStatus,
  SseNotificationUpdatedBulk,
  SseNotificationUpdatedSingle,
} from '@core/types/aura-notification-service.types';

type ActiveTab = 'inbox' | 'preferences';

@Component({
  selector: 'app-user-notifications',
  standalone: true,
  imports: [],
  templateUrl: './user-notifications.html',
  styleUrls: ['./user-notifications.css'],
})
export class UserNotifications implements OnInit, OnDestroy {
  private readonly http = inject(AuraNotificationServiceHttp);
  private readonly sse = inject(NotificationSseService);
  private readonly notifState = inject(NotificationState);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  // ── Inbox state ────────────────────────────────────────────────────────────
  // Which view is shown is decided by the route (sidebar entries), not in-component tabs.
  readonly activeTab = signal<ActiveTab>(
    (this.route.snapshot.data['tab'] as ActiveTab) ?? 'inbox',
  );
  readonly statusFilter = signal<NotificationStatus | null>(null);
  readonly notifications = signal<NotificationDto[]>([]);
  readonly hasMore = signal(false);
  readonly loadingList = signal(false);
  readonly loadingMore = signal(false);
  readonly unreadCount = this.notifState.unreadCount;

  private currentPage = 1;

  // ── Preferences state ──────────────────────────────────────────────────────
  readonly preferences = signal<NotificationPreferenceDto | null>(null);
  readonly eventCatalogue = signal<EventTypeCatalogueEntryDto[]>([]);
  readonly loadingPrefs = signal(false);
  readonly muteInput = signal('');
  readonly savingMute = signal(false);

  readonly minDatetime = this.toDatetimeLocalValue(new Date().toISOString());

  // ──────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadUnreadCount();
    this.sse.connect();

    this.sse.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleSseEvent(event));

    if (this.activeTab() === 'preferences') {
      this.loadPreferences();
    } else {
      this.loadNotifications();
    }
  }

  ngOnDestroy(): void {
    this.sse.disconnect();
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  setFilter(status: NotificationStatus | null): void {
    this.statusFilter.set(status);
    this.currentPage = 1;
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loadingList.set(true);
    this.currentPage = 1;
    const filter = this.statusFilter();
    this.http.listNotifications({ ...(filter ? { status: filter } : {}), page_size: 20 }).subscribe({
      next: res => {
        this.notifications.set(res.results);
        this.hasMore.set(res.next !== null);
        this.loadingList.set(false);
      },
      error: () => {
        this.toast.show('No se pudieron cargar las notificaciones.', 'error');
        this.loadingList.set(false);
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.currentPage++;
    const filter = this.statusFilter();
    this.http.listNotifications({ ...(filter ? { status: filter } : {}), page: this.currentPage, page_size: 20 }).subscribe({
      next: res => {
        this.notifications.update(list => [...list, ...res.results]);
        this.hasMore.set(res.next !== null);
        this.loadingMore.set(false);
      },
      error: () => {
        this.currentPage--;
        this.toast.show('No se pudieron cargar más notificaciones.', 'error');
        this.loadingMore.set(false);
      },
    });
  }

  markAsRead(id: number): void {
    this.http.updateNotificationStatus(id, { status: 'read' }).subscribe({
      next: updated => this.replaceNotification(updated),
      error: () => this.toast.show('No se pudo marcar como leída.', 'error'),
    });
  }

  markAsUnread(id: number): void {
    this.http.updateNotificationStatus(id, { status: 'unread' }).subscribe({
      next: updated => this.replaceNotification(updated),
      error: () => this.toast.show('No se pudo marcar como no leída.', 'error'),
    });
  }

  deleteNotification(id: number): void {
    this.http.deleteNotification(id).subscribe({
      next: () => {
        // The SSE `notification.deleted` event may have already removed it; only
        // decrement if the item is still present so the badge isn't decremented twice.
        const item = this.notifications().find(n => n.id === id);
        if (item?.status === 'unread') this.notifState.decrement();
        this.removeNotification(id);
      },
      error: () => this.toast.show('No se pudo eliminar la notificación.', 'error'),
    });
  }

  markAllRead(): void {
    this.http.markAllRead({}).subscribe({
      next: res => {
        this.notifications.update(list =>
          list.map(n => n.status === 'unread' ? { ...n, status: 'read' as NotificationStatus } : n),
        );
        this.notifState.reset();
        this.toast.show(`${res.updated} notificaciones marcadas como leídas.`, 'success');
      },
      error: () => this.toast.show('No se pudo marcar todo como leído.', 'error'),
    });
  }

  // ── Preferences ────────────────────────────────────────────────────────────

  private loadPreferences(): void {
    this.loadingPrefs.set(true);
    this.http.getPreferences().subscribe({
      next: prefs => {
        this.preferences.set(prefs);
        if (prefs.mute_until) {
          this.muteInput.set(this.toDatetimeLocalValue(prefs.mute_until));
        }
      },
      error: () => this.toast.show('No se pudieron cargar las preferencias.', 'error'),
    });
    this.http.getEventTypeCatalogue().subscribe({
      next: list => {
        this.eventCatalogue.set(list);
        this.loadingPrefs.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar el catálogo de eventos.', 'error');
        this.loadingPrefs.set(false);
      },
    });
  }

  toggleGlobalInapp(enabled: boolean): void {
    this.http.updatePreferences({ inapp_enabled: enabled }).subscribe({
      next: updated => this.preferences.set(updated),
      error: () => this.toast.show('No se pudo actualizar la preferencia.', 'error'),
    });
  }

  toggleGlobalEmail(enabled: boolean): void {
    this.http.updatePreferences({ email_enabled: enabled }).subscribe({
      next: updated => this.preferences.set(updated),
      error: () => this.toast.show('No se pudo actualizar la preferencia.', 'error'),
    });
  }

  saveMuteUntil(): void {
    const raw = this.muteInput();
    if (!raw) return;
    const iso = new Date(raw).toISOString();
    this.savingMute.set(true);
    this.http.updatePreferences({ mute_until: iso }).subscribe({
      next: updated => {
        this.preferences.set(updated);
        this.savingMute.set(false);
        this.toast.show('Silencio activado.', 'success');
      },
      error: () => {
        this.savingMute.set(false);
        this.toast.show('La fecha debe ser futura.', 'error');
      },
    });
  }

  clearMute(): void {
    this.http.updatePreferences({ mute_until: null }).subscribe({
      next: updated => {
        this.preferences.set(updated);
        this.muteInput.set('');
        this.toast.show('Silencio desactivado.', 'success');
      },
      error: () => this.toast.show('No se pudo desactivar el silencio.', 'error'),
    });
  }

  // ── SSE ────────────────────────────────────────────────────────────────────

  private handleSseEvent(event: { type: string; data: unknown }): void {
    switch (event.type) {
      case 'notification.created': {
        const notif = event.data as NotificationDto;
        this.notifications.update(list => [notif, ...list]);
        if (notif.status === 'unread') this.notifState.increment();
        break;
      }
      case 'notification.updated': {
        const payload = event.data as SseNotificationUpdatedSingle | SseNotificationUpdatedBulk;
        if ('all_marked_read' in payload) {
          this.notifications.update(list =>
            list.map(n => n.status === 'unread' ? { ...n, status: 'read' as NotificationStatus } : n),
          );
          this.notifState.reset();
        } else {
          this.notifications.update(list =>
            list.map(n => n.id === payload.id ? { ...n, status: payload.status } : n),
          );
          if (payload.status === 'read') this.notifState.decrement();
          if (payload.status === 'unread') this.notifState.increment();
        }
        break;
      }
      case 'notification.deleted': {
        const { id } = event.data as { id: number };
        const item = this.notifications().find(n => n.id === id);
        if (item?.status === 'unread') this.notifState.decrement();
        this.removeNotification(id);
        break;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getSenderDisplay(n: NotificationDto): string {
    if (n.actor_name) return n.actor_name;
    const category = this.getEventCategory(n.event_type);
    if (category === 'admin') return 'Administrador';
    return 'Sistema';
  }

  getSenderInitials(n: NotificationDto): string {
    // Separa por espacios y separadores de username (. _ -): "ten.lopez" → "TL".
    const parts = this.getSenderDisplay(n).trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** First segment of the event type (`chat`, `auth`, `document`, `admin`, `system`) — used for avatar styling. */
  getEventCategory(eventType: string): string {
    return eventType.split('.')[0] || 'system';
  }

  getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;
    if (hours < 24) return `hace ${hours}h`;
    if (days < 30) return `hace ${days} días`;
    return new Date(dateStr).toLocaleDateString('es');
  }

  formatMuteUntil(iso: string): string {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  }

  hasChannel(entry: EventTypeCatalogueEntryDto, channel: 'inapp' | 'email'): boolean {
    return entry.default_channels.includes(channel);
  }

  private replaceNotification(updated: NotificationDto): void {
    const prev = this.notifications().find(n => n.id === updated.id);
    if (prev?.status === 'unread' && updated.status !== 'unread') this.notifState.decrement();
    if (prev?.status !== 'unread' && updated.status === 'unread') this.notifState.increment();
    this.notifications.update(list => list.map(n => n.id === updated.id ? updated : n));
  }

  private removeNotification(id: number): void {
    this.notifications.update(list => list.filter(n => n.id !== id));
  }

  private loadUnreadCount(): void {
    this.http.getUnreadCount().subscribe({
      next: res => this.notifState.setUnreadCount(res.count),
    });
  }

  toDatetimeLocalValue(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
