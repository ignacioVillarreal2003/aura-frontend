import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuraChatServiceHttp } from '../../../../core/services/http-services/aura-chat-service-http.service';
import { UserState } from '@core/state/user.state';
import type {
  FeedbackAnalyticsDto,
  FeedbackReason,
} from '../../../../core/types/aura-chat-service.types';

const REASON_LABELS: Record<FeedbackReason, string> = {
  incorrect: 'Información incorrecta',
  incomplete: 'Respuesta incompleta',
  off_topic: 'No responde lo preguntado',
  tone: 'Tono o estilo inadecuado',
  too_long: 'Demasiado larga',
  hallucination: 'Inventó datos',
  other: 'Otro',
};

const WINDOW_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 7, label: 'Últimos 7 días' },
  { value: 30, label: 'Últimos 30 días' },
  { value: 90, label: 'Últimos 90 días' },
  { value: 365, label: 'Último año' },
];

@Component({
  selector: 'app-feedback-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-analytics.component.html',
  styleUrl: './feedback-analytics.component.css',
})
export class FeedbackAnalyticsComponent implements OnInit {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly userState = inject(UserState);

  readonly windowOptions = WINDOW_OPTIONS;
  readonly days = signal(30);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<FeedbackAnalyticsDto | null>(null);

  readonly canView = computed(() =>
    (this.userState.user()?.permissions ?? []).includes('VIEW_FEEDBACK_ANALYTICS')
  );

  ngOnInit(): void {
    if (this.canView()) this.load();
    else this.loading.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.chatHttp.getFeedbackAnalytics({ days: this.days() }).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las métricas de feedback.');
        this.loading.set(false);
      },
    });
  }

  onWindowChange(value: number): void {
    this.days.set(Number(value));
    this.load();
  }

  reasonLabel(reason: FeedbackReason | null): string {
    return reason ? REASON_LABELS[reason] : 'Sin motivo';
  }

  /** Satisfaction as an integer percentage, or null when there is no feedback. */
  ratePct(rate: number | null): number | null {
    return rate == null ? null : Math.round(rate * 100);
  }
}
