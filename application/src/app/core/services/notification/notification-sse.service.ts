import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Observable, Subject, Subscription, retry, repeat, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import type { SseEvent, SseEventType } from '@core/types/aura-notification-service.types';

@Injectable({ providedIn: 'root' })
export class NotificationSseService implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly ngZone = inject(NgZone);
  private readonly base = environment.notificationApiUrl.replace(/\/$/, '');

  private subscription: Subscription | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly _events$ = new Subject<SseEvent>();

  readonly events$ = this._events$.asObservable();

  connect(): void {
    if (this.subscription) return;
    this.subscription = this.createStream$().pipe(
      retry({ delay: (_, retryCount) => timer(Math.min(retryCount * 2000, 30_000)) }),
      repeat({ delay: 3000 }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: event => this.ngZone.run(() => this._events$.next(event)),
    });
  }

  disconnect(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private createStream$(): Observable<SseEvent> {
    return new Observable<SseEvent>(observer => {
      const url = `${this.base}/api/v1/notifications/stream/`;
      const token = this.auth.getToken();
      const controller = new AbortController();

      const run = async (): Promise<void> => {
        try {
          const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            observer.error(new Error(`SSE error: ${response.status}`));
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentType = '';
          let dataLines: string[] = [];

          for (;;) {
            const { done, value } = await reader.read();
            if (done) { observer.complete(); break; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataLines.push(line.slice(6));
              } else if (line === '' && dataLines.length > 0) {
                try {
                  const data = JSON.parse(dataLines.join('\n')) as unknown;
                  observer.next({ type: currentType as SseEventType, data });
                } catch { /* ignore malformed event */ }
                currentType = '';
                dataLines = [];
              }
            }
          }
        } catch (err: unknown) {
          if ((err as DOMException | null)?.name !== 'AbortError') {
            observer.error(err);
          } else {
            observer.complete();
          }
        }
      };

      void run();
      return () => controller.abort();
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
