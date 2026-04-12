import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ChatApiMessage } from '@core/models/types/chat.types';
import { ChatService } from '@core/services/chat.service';

type ChatListRow = { id: string; title: string; lastTs: number };

function lastActivityTs(messages: ChatApiMessage[]): number {
  if (!messages.length) return 0;
  return messages.reduce((max, m) => Math.max(max, new Date(m.created_at).getTime()), 0);
}

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-search.component.html',
  styleUrls: ['./chat-search.component.css'],
})
export class ChatSearchComponent implements OnInit {
  private chatService = inject(ChatService);

  searchQuery = '';
  private rows: ChatListRow[] = [];

  ngOnInit(): void {
    this.refreshFromService();
  }

  private refreshFromService(): void {
    this.rows = this.chatService
      .getAllSessions()
      .map((s) => ({
        id: s.routeKey,
        title: s.detail.name,
        lastTs: lastActivityTs(s.messages),
      }))
      .sort((a, b) => b.lastTs - a.lastTs);
  }

  /** Sesiones filtradas por búsqueda y agrupadas por antigüedad (misma fuente que el sidebar). */
  get groupedChats(): { hoy: ChatListRow[]; ayer: ChatListRow[]; semana: ChatListRow[] } {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = q ? this.rows.filter((r) => r.title.toLowerCase().includes(q)) : [...this.rows];

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86400000;

    const hoy: ChatListRow[] = [];
    const ayer: ChatListRow[] = [];
    const semana: ChatListRow[] = [];

    for (const r of filtered) {
      const t = r.lastTs > 0 ? r.lastTs : Date.now();
      if (t >= startToday) hoy.push(r);
      else if (t >= startYesterday) ayer.push(r);
      else semana.push(r);
    }

    return { hoy, ayer, semana };
  }
}
