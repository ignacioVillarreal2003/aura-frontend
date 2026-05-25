export type NotificationStatus = 'unread' | 'read' | 'archived';
export type NotificationType = 'system' | 'admin' | 'user' | 'event';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';
export type NotificationChannel = 'inapp' | 'email';

export interface NotificationDto {
  readonly id: number;
  readonly receiver_id: number;
  readonly title: string | null;
  readonly message: string;
  readonly type: NotificationType;
  readonly event_type: string | null;
  readonly event_key: string | null;
  readonly data: Record<string, unknown>;
  readonly severity: NotificationSeverity;
  readonly link_url: string | null;
  readonly sender_name: string | null;
  readonly target_scope: string;
  readonly target_label: string | null;
  readonly status: NotificationStatus;
  readonly read_at: string | null;
  readonly created_by: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PaginatedNotificationsDto {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: NotificationDto[];
}

export interface UnreadCountDto {
  readonly count: number;
}

export interface NotificationStatusUpdateBody {
  readonly status: NotificationStatus;
}

export interface MarkAllReadBody {
  readonly until_id?: number;
}

export interface MarkAllReadResponseDto {
  readonly updated: number;
}

export interface NotificationListParams {
  readonly status?: NotificationStatus | NotificationStatus[];
  readonly event_type?: string;
  readonly type?: NotificationType;
  readonly since?: string;
  readonly page?: number;
  readonly page_size?: number;
}

export interface NotificationPreferenceDto {
  readonly user_id: number;
  readonly inapp_enabled: boolean;
  readonly email_enabled: boolean;
  readonly mute_until: string | null;
  readonly updated_at: string;
}

export interface NotificationPreferenceUpdateBody {
  readonly inapp_enabled?: boolean;
  readonly email_enabled?: boolean;
  readonly mute_until?: string | null;
}

export interface EventPreferenceChannels {
  readonly inapp: boolean;
  readonly email: boolean;
}

export interface EventPreferenceEntryDto {
  readonly event_type: string;
  readonly type: NotificationType;
  readonly severity: NotificationSeverity;
  readonly description: string;
  readonly default_channels: NotificationChannel[];
  readonly available_channels: NotificationChannel[];
  readonly is_silenceable: boolean;
  readonly channels: EventPreferenceChannels;
}

export interface EventPreferenceUpdateBody {
  readonly inapp_enabled?: boolean;
  readonly email_enabled?: boolean;
}

// SSE
export type SseEventType =
  | 'stream.opened'
  | 'notification.created'
  | 'notification.updated'
  | 'notification.deleted'
  | 'stream.closed'
  | 'stream.error';

export interface SseEvent<T = unknown> {
  readonly type: SseEventType | string;
  readonly data: T;
}

export interface SseNotificationUpdatedSingle {
  readonly id: number;
  readonly status: NotificationStatus;
}

export interface SseNotificationUpdatedBulk {
  readonly all_marked_read: true;
  readonly count: number;
  readonly until_id?: number;
}
