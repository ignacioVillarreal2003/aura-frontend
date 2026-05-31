import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { ChatListItemDto } from '@aura-types/aura-chat-service.types';

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

  searchQuery = '';
  private readonly allChats = signal<ChatListItemDto[]>([]);
  private readonly activeTagFilters = signal<Set<string>>(new Set());

  readonly activeTagFiltersArray = computed(() => [...this.activeTagFilters()]);

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    for (const c of this.allChats()) {
      for (const t of c.tags ?? []) tags.add(t);
    }
    return [...tags].sort();
  });

  readonly grouped = signal<{
    hoy: ChatListItem[];
    ayer: ChatListItem[];
    semana: ChatListItem[];
  }>({ hoy: [], ayer: [], semana: [] });

  ngOnInit(): void {
    this.api.listChats({ page_size: 100 }).subscribe({
      next: (page) => {
        this.allChats.set([...page.results]);
        this.rebuildGrouped();
      },
      error: () => this.toast.show('No se pudieron cargar los chats.', 'error'),
    });
  }

  onSearchChange(): void {
    this.rebuildGrouped();
  }

  toggleTagFilter(tag: string): void {
    this.activeTagFilters.update((s) => {
      const next = new Set(s);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
    this.rebuildGrouped();
  }

  clearAllFilters(): void {
    this.activeTagFilters.set(new Set());
    this.searchQuery = '';
    this.rebuildGrouped();
  }

  isTagActive(tag: string): boolean {
    return this.activeTagFilters().has(tag);
  }

  private rebuildGrouped(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const activeTags = this.activeTagFilters();

    const filtered = this.allChats().filter((c) => {
      const tags = c.tags ?? [];
      const matchesQuery = !q
        || c.name.toLowerCase().includes(q)
        || tags.some((t) => t.toLowerCase().includes(q));
      const matchesTags = activeTags.size === 0
        || [...activeTags].every((t) => tags.includes(t));
      return matchesQuery && matchesTags;
    });

    const hoy: ChatListItem[] = [];
    const ayer: ChatListItem[] = [];
    const semana: ChatListItem[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    for (const c of filtered) {
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
      } else {
        semana.push(item);
      }
    }

    const byRecent = (a: ChatListItem, b: ChatListItem) => b.sortKey - a.sortKey;
    hoy.sort(byRecent);
    ayer.sort(byRecent);
    semana.sort(byRecent);

    this.grouped.set({ hoy, ayer, semana });
  }
}
