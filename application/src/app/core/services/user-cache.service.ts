import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AuraAuthServiceHttp } from './http-services/aura-auth-service-http.service';
import type { UserLookupDto } from '@aura-types/aura-auth-service.types';

@Injectable({ providedIn: 'root' })
export class UserCacheService {
  private readonly authHttp = inject(AuraAuthServiceHttp);
  private readonly _cache = new Map<number, UserLookupDto>();

  /** Returns a snapshot from cache, or null if not loaded yet. */
  get(id: number): UserLookupDto | null {
    return this._cache.get(id) ?? null;
  }

  /**
   * Resolves the given IDs. Already-cached IDs are returned immediately;
   * only uncached IDs are fetched from the backend.
   * Returns a Map<id, UserLookupDto> for all requested IDs that were found.
   */
  resolve(ids: number[]): Observable<Map<number, UserLookupDto>> {
    const unique = [...new Set(ids)];
    const missing = unique.filter((id) => !this._cache.has(id));

    if (missing.length === 0) {
      return of(this._snapshotFor(unique));
    }

    return this.authHttp.getUsersByIds(missing).pipe(
      tap((res) => {
        for (const u of res.results) {
          this._cache.set(u.id, u);
        }
      }),
      map(() => this._snapshotFor(unique)),
    );
  }

  /** Evict a single entry (e.g. after a profile update). */
  invalidate(id: number): void {
    this._cache.delete(id);
  }

  private _snapshotFor(ids: number[]): Map<number, UserLookupDto> {
    const m = new Map<number, UserLookupDto>();
    for (const id of ids) {
      const u = this._cache.get(id);
      if (u) m.set(id, u);
    }
    return m;
  }
}
