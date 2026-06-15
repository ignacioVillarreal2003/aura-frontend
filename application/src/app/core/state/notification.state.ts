import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationState {
  private readonly _unreadCount = signal<number>(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  setUnreadCount(count: number): void {
    this._unreadCount.set(count);
  }

  increment(): void {
    this._unreadCount.update(n => n + 1);
  }

  decrement(): void {
    this._unreadCount.update(n => Math.max(0, n - 1));
  }

  reset(): void {
    this._unreadCount.set(0);
  }
}
