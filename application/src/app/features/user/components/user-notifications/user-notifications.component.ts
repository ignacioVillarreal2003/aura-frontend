import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserSettingsState } from '@core/state/user-settings.state';
import { NotificationHttpService } from '@core/services/http/notification-http.service';
import { ToastService } from '@core/components/toast-service';
import type { NotificationApiRow } from '@core/models/types/notification.types';

@Component({
  selector: 'app-user-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-notifications.component.html',
  styleUrls: ['./user-notifications.component.css'],
})
export class UserNotificationsComponent implements OnInit {
  readonly store = inject(UserSettingsState);
  private readonly notificationHttp = inject(NotificationHttpService);
  private readonly toast = inject(ToastService);

  readonly notifications = signal<NotificationApiRow[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.notificationHttp.list().subscribe({
      next: (res) => {
        this.notifications.set(res.results);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudieron cargar las notificaciones.', 'error');
        this.loading.set(false);
      },
    });
  }

  markAsRead(id: number): void {
    this.notificationHttp.updateStatus(id, { status: 'read' }).subscribe({
      next: (updated) => {
        this.notifications.update((list) =>
          list.map((n) => (n.id === id ? updated : n))
        );
      },
      error: () => this.toast.show('No se pudo marcar como leída.', 'error'),
    });
  }

  markAllAsRead(): void {
    const unread = this.notifications().filter((n) => n.status === 'unread');
    unread.forEach((n) => this.markAsRead(n.id));
  }

  deleteNotification(id: number): void {
    this.notificationHttp.delete(id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => n.id !== id));
      },
      error: () => this.toast.show('No se pudo eliminar la notificación.', 'error'),
    });
  }

  getSenderDisplay(notification: NotificationApiRow): string {
    if (notification.sender_name) return notification.sender_name;
    if (notification.type === 'system') return 'Sistema';
    if (notification.type === 'admin') return 'Administrador';
    return 'Usuario';
  }

  getSenderInitials(notification: NotificationApiRow): string {
    const name = this.getSenderDisplay(notification);
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  getUnreadCount(): number {
    return this.notifications().filter((n) => n.status === 'unread').length;
  }

  getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `hace ${minutes} min`;
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${days} días`;
  }
}
