import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  EventPreferenceEntryDto,
  EventPreferenceUpdateBody,
  MarkAllReadBody,
  MarkAllReadResponseDto,
  NotificationDto,
  NotificationListParams,
  NotificationPreferenceDto,
  NotificationPreferenceUpdateBody,
  NotificationStatusUpdateBody,
  PaginatedNotificationsDto,
  UnreadCountDto,
} from '@aura-types/aura-notification-service.types';

@Injectable({ providedIn: 'root' })
export class AuraNotificationServiceHttp {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.notificationApiUrl.replace(/\/$/, '')}/api/v1`;

  listNotifications(params?: NotificationListParams): Observable<PaginatedNotificationsDto> {
    let httpParams = new HttpParams();
    if (params?.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      statuses.forEach(s => { httpParams = httpParams.append('status', s); });
    }
    if (params?.event_type) httpParams = httpParams.set('event_type', params.event_type);
    if (params?.type) httpParams = httpParams.set('type', params.type);
    if (params?.since) httpParams = httpParams.set('since', params.since);
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.page_size != null) httpParams = httpParams.set('page_size', String(params.page_size));
    return this.http.get<PaginatedNotificationsDto>(`${this.base}/notifications/`, { params: httpParams });
  }

  getUnreadCount(): Observable<UnreadCountDto> {
    return this.http.get<UnreadCountDto>(`${this.base}/notifications/unread-count/`);
  }

  getNotification(id: number): Observable<NotificationDto> {
    return this.http.get<NotificationDto>(`${this.base}/notifications/${id}/`);
  }

  updateNotificationStatus(id: number, body: NotificationStatusUpdateBody): Observable<NotificationDto> {
    return this.http.patch<NotificationDto>(`${this.base}/notifications/${id}/`, body);
  }

  deleteNotification(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/${id}/`);
  }

  markAllRead(body: MarkAllReadBody = {}): Observable<MarkAllReadResponseDto> {
    return this.http.post<MarkAllReadResponseDto>(`${this.base}/notifications/mark-all-read/`, body);
  }

  getPreferences(): Observable<NotificationPreferenceDto> {
    return this.http.get<NotificationPreferenceDto>(`${this.base}/me/notification-preferences/`);
  }

  updatePreferences(body: NotificationPreferenceUpdateBody): Observable<NotificationPreferenceDto> {
    return this.http.put<NotificationPreferenceDto>(`${this.base}/me/notification-preferences/`, body);
  }

  getEventPreferences(): Observable<EventPreferenceEntryDto[]> {
    return this.http.get<EventPreferenceEntryDto[]>(`${this.base}/me/notification-preferences/event-types/`);
  }

  updateEventPreference(eventType: string, body: EventPreferenceUpdateBody): Observable<EventPreferenceEntryDto> {
    return this.http.put<EventPreferenceEntryDto>(
      `${this.base}/me/notification-preferences/event-types/${encodeURIComponent(eventType)}/`,
      body,
    );
  }
}
