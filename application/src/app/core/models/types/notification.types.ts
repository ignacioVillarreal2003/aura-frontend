export type NotificationType = 'system' | 'admin' | 'user';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface NotificationApiRow {
  id: number;
  receiver_id: number;
  message: string;
  type: NotificationType;
  sender_name: string | null;
  target_scope: string;
  target_label: string | null;
  status: NotificationStatus;
  read_at: string | null;
  created_by: number | null;
  created_at: string;
}

export interface PaginatedNotificationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NotificationApiRow[];
}

export interface UpdateNotificationStatusRequest {
  status: 'read' | 'archived';
}
