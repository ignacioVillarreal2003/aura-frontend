import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuraChatServiceHttp } from '../../../../core/services/http-services/aura-chat-service-http.service';
import { UserState } from '@core/state/user.state';
import type { AssistantDto } from '../../../../core/types/aura-chat-service.types';

@Component({
  selector: 'app-asistentes-hub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asistentes-hub.html',
  styleUrl: './asistentes-hub.css',
})
export class AsistentesHub implements OnInit {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly router = inject(Router);
  private readonly userState = inject(UserState);

  readonly canViewAnalytics = computed(() =>
    (this.userState.user()?.permissions ?? []).includes('VIEW_FEEDBACK_ANALYTICS')
  );

  readonly assistants = signal<AssistantDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly startingId = signal<number | null>(null);
  readonly search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.assistants();
    return this.assistants().filter((a) => a.name.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this._load();
  }

  private _load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.chatHttp.listAssistants({ page_size: 100 }).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.assistants.set([...page.results]);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar los asistentes.');
      },
    });
  }

  goToAnalytics(): void {
    void this.router.navigate(['/main-container', 'feedback-analytics']);
  }

  startChat(assistant: AssistantDto): void {
    if (this.startingId() !== null) return;
    this.startingId.set(assistant.id);
    this.chatHttp.startAssistantChat(assistant.id).subscribe({
      next: (resp) => {
        this.startingId.set(null);
        void this.router.navigate(['/main-container', 'chat', resp.chat_id]);
      },
      error: () => {
        this.startingId.set(null);
        this.error.set(`No se pudo iniciar la sesión con "${assistant.name}".`);
      },
    });
  }
}
