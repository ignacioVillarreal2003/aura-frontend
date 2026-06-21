import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';

import { AuraDocumentProcessingServiceHttp } from '@core/services/http-services/aura-document-processing-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { DOCUMENT_SEARCH_MAX_QUERY_CHARS } from '@aura-types/aura-document-processing-service.types';
import type {
  DocumentSearchMode,
  DocumentSearchResultDto,
} from '@aura-types/aura-document-processing-service.types';

const MIN_QUERY_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 8;

interface SearchMode {
  readonly id: DocumentSearchMode;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
  readonly shortHint: string;
}

@Component({
  selector: 'app-document-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-search.html',
  styleUrl: './document-search.css',
})
export class DocumentSearch {
  private readonly docHttp = inject(AuraDocumentProcessingServiceHttp);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly maxQueryChars = DOCUMENT_SEARCH_MAX_QUERY_CHARS;

  readonly modes: readonly SearchMode[] = [
    {
      id: 'vector',
      label: 'Significado',
      icon: 'pi-sparkles',
      hint: 'Búsqueda inteligente: combina significado y palabras clave, reordenada por relevancia con un reranker.',
      shortHint: 'Busca por el sentido del texto, aunque no uses las palabras exactas.',
    },
    {
      id: 'bm25',
      label: 'Palabras',
      icon: 'pi-align-left',
      hint: 'Búsqueda BM25: relevancia léxica por las palabras exactas de la consulta.',
      shortHint: 'Busca los términos exactos que escribís.',
    },
  ];

  readonly activeMode = computed(
    () => this.modes.find((m) => m.id === this.mode()) ?? this.modes[0],
  );

  readonly query = signal('');
  readonly mode = signal<DocumentSearchMode>('vector');

  readonly results = signal<DocumentSearchResultDto[]>([]);
  readonly searched = signal(false);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly failed = signal(false);
  readonly hasMore = signal(false);
  readonly downloadingId = signal<number | null>(null);

  private currentPage = 0;
  private searchSeq = 0;

  private readonly queryInput$ = new Subject<string>();

  constructor() {
    this.queryInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.startNewSearch());
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.queryInput$.next(value.trim());
  }

  clearQuery(): void {
    this.query.set('');
    this.queryInput$.next('');
  }

  selectMode(mode: DocumentSearchMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.startNewSearch();
  }

  retry(): void {
    if (this.query().trim().length >= MIN_QUERY_CHARS) {
      this.loadPage(1, true);
    }
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.loadPage(this.currentPage + 1, false);
  }

  private startNewSearch(): void {
    const query = this.query().trim();
    this.searchSeq += 1;
    this.results.set([]);
    this.currentPage = 0;
    this.hasMore.set(false);
    this.failed.set(false);

    if (query.length < MIN_QUERY_CHARS) {
      this.loading.set(false);
      this.loadingMore.set(false);
      this.searched.set(false);
      return;
    }

    this.searched.set(true);
    this.loadPage(1, true);
  }

  private loadPage(page: number, isNew: boolean): void {
    const query = this.query().trim();
    if (query.length < MIN_QUERY_CHARS) return;

    const seq = this.searchSeq;
    if (isNew) {
      this.loading.set(true);
      this.failed.set(false);
    } else {
      this.loadingMore.set(true);
    }

    this.docHttp
      .searchDocumentsByContent({ query, mode: this.mode(), page, page_size: PAGE_SIZE })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (seq !== this.searchSeq) return;
          this.loading.set(false);
          this.loadingMore.set(false);
          this.results.update((cur) =>
            isNew ? [...res.results] : [...cur, ...res.results],
          );
          this.currentPage = res.page;
          this.hasMore.set(res.has_more);
        },
        error: () => {
          if (seq !== this.searchSeq) return;
          this.loading.set(false);
          this.loadingMore.set(false);
          if (isNew) {
            this.failed.set(true);
          } else {
            this.toastService.show('No se pudieron cargar más resultados.', 'error');
          }
        },
      });
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

  relevancePercent(result: DocumentSearchResultDto): number {
    return Math.round(Math.min(Math.max(result.similarity, 0), 1) * 100);
  }

  matchLabel(): string {
    return this.mode() === 'bm25' ? 'relevante' : 'similar';
  }

  documentIcon(result: DocumentSearchResultDto): string {
    const mime = result.document.mime_type.toLowerCase();
    if (mime.includes('pdf')) return 'pi-file-pdf';
    if (mime.includes('word') || mime.includes('wordprocessingml') || mime.includes('docx')) return 'pi-file-word';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv') || mime.includes('xlsx')) return 'pi-file-excel';
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
