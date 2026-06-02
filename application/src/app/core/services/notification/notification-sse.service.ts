import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Observable, Subject, Subscription, firstValueFrom, retry, repeat, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import type { SseEvent, SseEventType } from '@core/types/aura-notification-service.types';

/**
 * Shared SSE connection to the notification service.
 *
 * Singleton, so several consumers (the chat shell, the notifications page) can
 * subscribe to `events$` at once. Connection lifecycle is **ref-counted** via
 * `connect()`/`disconnect()`: the underlying stream stays open while at least
 * one consumer holds it, and only closes when the last one releases. This
 * prevents one component's `disconnect()` from tearing down the stream another
 * component still depends on.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSseService implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly ngZone = inject(NgZone);
  private readonly base = environment.notificationApiUrl.replace(/\/$/, '');

  private subscription: Subscription | null = null;
  private refCount = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly _events$ = new Subject<SseEvent>();

  readonly events$ = this._events$.asObservable();

  /** Acquire the shared stream. Pair every `connect()` with a `disconnect()`. */
  connect(): void {
    this.refCount++;
    if (this.subscription) return;

    this.subscription = this.createStream$()
      .pipe(
        retry({ delay: (_, retryCount) => timer(Math.min(retryCount * 2000, 30_000)) }),
        repeat({ delay: 3000 }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: event => this.ngZone.run(() => this._events$.next(event)),
      });
  }

  /** Release one hold on the stream; closes it only when no consumers remain. */
  disconnect(): void {
    if (this.refCount > 0) this.refCount--;
    if (this.refCount > 0) return;
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private createStream$(): Observable<SseEvent> {
    return new Observable<SseEvent>(observer => {
      const url = `${this.base}/api/v1/notifications/stream/`;
      const controller = new AbortController();
      let refreshedOnce = false;

      const fetchStream = (): Promise<Response> => {
        const token = this.auth.getToken();
        return fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
      };

      const run = async (): Promise<void> => {
        try {
          let response = await fetchStream();

          // Self-heal an expired access token once before giving up to the retry loop.
          if (response.status === 401 && !refreshedOnce) {
            refreshedOnce = true;
            try {
              await firstValueFrom(this.auth.refreshSession());
              response = await fetchStream();
            } catch {
              /* refresh failed; fall through to the error path below */
            }
          }

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
    this.refCount = 0;
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.destroy$.next();
    this.destroy$.complete();
  }
}
