import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import type { MessageDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-share-page',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './share-page.html',
  styleUrls: ['./share-page.css'],
})
export class SharePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(AuraChatServiceHttp);

  readonly messages = signal<MessageDto[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly nextUrl = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly messageCount = computed(() => this.messages().length);

  token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.error.set('Enlace de compartir inválido.');
      this.loading.set(false);
      return;
    }
    this.http.listPublicShareMessages(this.token, { page_size: 50 }).subscribe({
      next: (page) => {
        this.messages.set([...page.results]);
        this.nextUrl.set(page.next);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los mensajes. El enlace puede haber expirado.');
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    const url = this.nextUrl();
    if (!url || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.http.listPublicShareMessages(this.token, { url }).subscribe({
      next: (page) => {
        this.messages.update((m) => [...m, ...page.results]);
        this.nextUrl.set(page.next);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
