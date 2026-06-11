import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, take, tap } from 'rxjs/operators';

import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { DOCUMENT_SEARCH_MAX_QUERY_CHARS } from '@aura-types/aura-document-processing-service.types';
import type { DocumentSearchResultDto } from '@aura-types/aura-document-processing-service.types';

const MIN_QUERY_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 400;
const RESULTS_PER_SEARCH = 20;

interface SearchOutcome {
  readonly query: string;
  readonly results: readonly DocumentSearchResultDto[];
  readonly failed: boolean;
}

@Component({
  selector: 'app-document-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-search.component.html',
  styleUrl: './document-search.component.css',
})
export class DocumentSearchComponent {
  private readonly docHttp = inject(AuraDocumentProcessingServiceHttp);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly maxQueryChars = DOCUMENT_SEARCH_MAX_QUERY_CHARS;

  readonly query = signal('');
  readonly loading = signal(false);
  /** null = todavía no se buscó nada (estado inicial). */
  readonly outcome = signal<SearchOutcome | null>(null);
  readonly downloadingId = signal<number | null>(null);

  private readonly queryInput$ = new Subject<string>();

  constructor() {
    this.queryInput$
      .pipe(
        map((q) => q.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((q) => {
          if (q.length < MIN_QUERY_CHARS) {
            this.loading.set(false);
            this.outcome.set(null);
          }
        }),
        switchMap((q) => {
          if (q.length < MIN_QUERY_CHARS) return of(null);
          this.loading.set(true);
          return this.docHttp
            .searchDocumentsByContent({ query: q, max_documents: RESULTS_PER_SEARCH })
            .pipe(
              map((res): SearchOutcome => ({ query: q, results: res.results, failed: false })),
              catchError(() => of<SearchOutcome>({ query: q, results: [], failed: true })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        if (outcome === null) return;
        this.loading.set(false);
        this.outcome.set(outcome);
      });
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.queryInput$.next(value);
  }

  clearQuery(): void {
    this.query.set('');
    this.queryInput$.next('');
  }

  retry(): void {
    // Reinicia distinctUntilChanged para poder relanzar la misma consulta.
    this.queryInput$.next('');
    this.queryInput$.next(this.query());
  }

  downloadDocument(result: DocumentSearchResultDto): void {
    if (this.downloadingId() !== null) return;
    this.downloadingId.set(result.document.id);
    this.docHttp.downloadDocument(result.document.id).pipe(take(1)).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.document.name;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingId.set(null);
        this.toastService.show('No se pudo descargar el documento.', 'error');
      },
    });
  }

  similarityPercent(result: DocumentSearchResultDto): number {
    return Math.round(Math.min(Math.max(result.similarity, 0), 1) * 100);
  }

  documentIcon(result: DocumentSearchResultDto): string {
    const mime = result.document.mime_type.toLowerCase();
    if (mime.includes('pdf')) return 'pi-file-pdf';
    if (mime.includes('word') || mime.includes('wordprocessingml')) return 'pi-file-word';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'pi-file-excel';
    return 'pi-file';
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
  }
}
