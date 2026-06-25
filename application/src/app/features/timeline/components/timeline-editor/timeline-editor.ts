import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { ArtifactHeader } from '../../../../shared/components/artifact-header/artifact-header';
import { CircularTimeline, type TimelineItem } from '../circular-timeline/circular-timeline';
import type { TimelineDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-timeline-editor',
  standalone: true,
  imports: [CommonModule, ArtifactHeader, CircularTimeline],
  templateUrl: './timeline-editor.html',
  styleUrl: './timeline-editor.css',
})
export class TimelineEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly timeline = signal<TimelineDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly sortedEvents = computed(() => {
    const t = this.timeline();
    if (!t) return [];
    return [...t.events].sort((a, b) => a.position - b.position);
  });

  /** Eventos mapeados al formato que consume la línea de tiempo circular. */
  readonly timelineItems = computed<TimelineItem[]>(() =>
    this.sortedEvents().map((e) => ({
      id: e.id,
      year: e.occurred_label,
      title: e.title,
      description: e.description,
    })),
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getTimeline(id).pipe(take(1)).subscribe({
      next: (t) => {
        this.timeline.set(t);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la línea de tiempo.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  goBack(): void {
    const chatId = this.timeline()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  export(format: 'pdf' | 'markdown'): void {
    const t = this.timeline();
    if (!t || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (t.title || `timeline-${t.id}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const req$ = format === 'pdf' ? this.http.exportTimelinePdf(t.id) : this.http.exportTimelineMarkdown(t.id);
    req$.pipe(take(1)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${slug}.${format === 'pdf' ? 'pdf' : 'md'}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); this.exportingAs.set(null);
      },
      error: () => { this.exportingAs.set(null); this.toast.show('No se pudo exportar.', 'error'); },
    });
  }
}
