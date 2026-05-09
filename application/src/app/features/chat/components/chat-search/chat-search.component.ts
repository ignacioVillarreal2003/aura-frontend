import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { ToastService } from '@core/components/toast-service';
import type { ChatSummary } from '@core/models/deprecated/types/chat.types';

type ChatListItem = { id: string; title: string; sortKey: number };

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-search.component.html',
  styleUrls: ['./chat-search.component.css'],
})
export class ChatSearchComponent implements OnInit {
  private readonly api = inject(AuraChatApiService);
  private readonly toast = inject(ToastService);

  searchQuery = '';
  private readonly allChats = signal<ChatSummary[]>([]);

  readonly grouped = signal<{
    hoy: ChatListItem[];
    ayer: ChatListItem[];
    semana: ChatListItem[];
  }>({ hoy: [], ayer: [], semana: [] });

  ngOnInit(): void {
    this.api.listMyChats({ page_size: 100 }).subscribe({
      next: (page) => {
        this.allChats.set(page.data);
        this.rebuildGrouped();
      },
      error: () => this.toast.show('No se pudieron cargar los chats.', 'error'),
    });
  }

  onSearchChange(): void {
    this.rebuildGrouped();
  }

  private rebuildGrouped(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = this.allChats().filter((c) => !q || c.name.toLowerCase().includes(q));
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
      };
      if (d >= startOfToday) {
        hoy.push(item);
      } else if (d >= startOfYesterday) {
        ayer.push(item);
      } else if (d >= startOfWeek) {
        semana.push(item);
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
