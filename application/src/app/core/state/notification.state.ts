import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationState {
  readonly unreadCount = signal<number>(0);

  setUnreadCount(count: number): void {
    this.unreadCount.set(count);
  }

  increment(): void {
    this.unreadCount.update(n => n + 1);
  }

  decrement(): void {
    this.unreadCount.update(n => Math.max(0, n - 1));
  }

  reset(): void {
    this.unreadCount.set(0);
  }
}
