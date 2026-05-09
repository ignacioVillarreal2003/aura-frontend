import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  NotificationApiRow,
  NotificationStatus,
  PaginatedNotificationsResponse,
  UpdateNotificationStatusRequest,
} from '@core/models/types/notification.types';

@Injectable({ providedIn: 'root' })
export class NotificationHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.notificationApiUrl}/api`;

  list(statusFilter?: NotificationStatus): Observable<PaginatedNotificationsResponse> {
    let params = new HttpParams();
    if (statusFilter) {
      params = params.set('status', statusFilter);
    }
    return this.http.get<PaginatedNotificationsResponse>(`${this.base}/notifications/`, { params });
  }

  updateStatus(id: number, body: UpdateNotificationStatusRequest): Observable<NotificationApiRow> {
    return this.http.patch<NotificationApiRow>(`${this.base}/notifications/${id}/status/`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/${id}/`);
  }
}
