import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { ChatListItemDto, PageNumberResult } from '@aura-types/aura-chat-service.types';

type ChatListItem = { id: string; title: string; sortKey: number; tags: readonly string[] };

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-search.component.html',
  styleUrls: ['./chat-search.component.css'],
})
export class ChatSearchComponent implements OnInit {
  private readonly api = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly filterChange$ = new Subject<void>();
  private nextUrl: string | null = null;

  searchQuery = '';
  private readonly loadedChats = signal<ChatListItemDto[]>([]);
  private readonly activeTagFilters = signal<Set<string>>(new Set());
  private readonly knownTags = signal<Set<string>>(new Set());

  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);

  readonly activeTagFiltersArray = computed(() => [...this.activeTagFilters()]);
  readonly allTags = computed(() => [...this.knownTags()].sort());

  readonly grouped = signal<{
    hoy: ChatListItem[];
    ayer: ChatListItem[];
    semana: ChatListItem[];
    anteriores: ChatListItem[];
  }>({ hoy: [], ayer: [], semana: [], anteriores: [] });

  ngOnInit(): void {
    this.filterChange$.pipe(
      debounceTime(300),
      switchMap(() => {
        this.loading.set(true);
        this.loadedChats.set([]);
        this.nextUrl = null;
        return this.api.listChats(this.buildQuery());
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (page) => this.applyPage(page, true),
      error: () => {
        this.toast.show('No se pudieron cargar los chats.', 'error');
        this.loading.set(false);
      },
    });

    this.filterChange$.next();
  }

  onSearchChange(): void {
    this.filterChange$.next();
  }

  toggleTagFilter(tag: string): void {
    this.activeTagFilters.update((s) => {
      const next = new Set(s);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
    this.filterChange$.next();
  }

  clearAllFilters(): void {
    this.activeTagFilters.set(new Set());
    this.searchQuery = '';
    this.filterChange$.next();
  }

  isTagActive(tag: string): boolean {
    return this.activeTagFilters().has(tag);
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore() || !this.nextUrl) return;
    this.loadingMore.set(true);
    this.api.listChats({ url: this.nextUrl }).pipe(take(1)).subscribe({
      next: (page) => this.applyPage(page, false),
      error: () => {
        this.toast.show('No se pudieron cargar los chats.', 'error');
        this.loadingMore.set(false);
      },
    });
  }

  private buildQuery() {
    const activeTags = [...this.activeTagFilters()];
    return {
      search: this.searchQuery.trim() || undefined,
      tags: activeTags.length > 0 ? activeTags.join(',') : undefined,
      page_size: 30,
    };
  }

  private applyPage(page: PageNumberResult<ChatListItemDto>, reset: boolean): void {
    const results = [...page.results];
    this.knownTags.update((set) => {
      const next = new Set(set);
      for (const c of results) {
        for (const t of c.tags ?? []) next.add(t);
      }
      return next;
    });
    if (reset) {
      this.loadedChats.set(results);
    } else {
      this.loadedChats.update((prev) => [...prev, ...results]);
    }
    this.nextUrl = page.next;
    this.hasMore.set(page.next !== null);
    this.loading.set(false);
    this.loadingMore.set(false);
    this.rebuildGrouped();
  }

  private rebuildGrouped(): void {
    const hoy: ChatListItem[] = [];
    const ayer: ChatListItem[] = [];
    const semana: ChatListItem[] = [];
    const anteriores: ChatListItem[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    for (const c of this.loadedChats()) {
      const raw = c.last_message_at ?? c.created_at;
      const d = new Date(raw);
      const item: ChatListItem = {
        id: String(c.id),
        title: c.name,
        sortKey: d.getTime(),
        tags: c.tags ?? [],
      };
      if (d >= startOfToday) {
        hoy.push(item);
      } else if (d >= startOfYesterday) {
        ayer.push(item);
      } else if (d >= startOfWeek) {
        semana.push(item);
      } else {
        anteriores.push(item);
      }
    }

    const byRecent = (a: ChatListItem, b: ChatListItem) => b.sortKey - a.sortKey;
    hoy.sort(byRecent);
    ayer.sort(byRecent);
    semana.sort(byRecent);
    anteriores.sort(byRecent);

    this.grouped.set({ hoy, ayer, semana, anteriores });
  }
}
