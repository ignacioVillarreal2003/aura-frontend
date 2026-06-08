import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { TimelineDto } from '@aura-types/aura-chat-service.types';

interface EditEvent {
  uid: string;
  title: string;
  description: string;
  occurred_label: string;
  occurred_at: string;
}

@Component({
  selector: 'app-timeline-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline-editor.html',
  styleUrl: './timeline-editor.css',
})
export class TimelineEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly timeline = signal<TimelineDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly editTitle = signal('');
  readonly editSummary = signal('');
  readonly events = signal<EditEvent[]>([]);

  readonly hasChanges = computed(() => !!this.timeline());

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getTimeline(id).pipe(take(1)).subscribe({
      next: (t) => {
        this.timeline.set(t);
        this._syncFromTimeline(t);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la línea de tiempo.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  private _syncFromTimeline(t: TimelineDto): void {
    this.editTitle.set(t.title);
    this.editSummary.set(t.summary);
    this.events.set(
      [...t.events]
        .sort((a, b) => a.position - b.position)
        .map((e) => ({
          uid: e.id.toString(),
          title: e.title,
          description: e.description,
          occurred_label: e.occurred_label,
          occurred_at: e.occurred_at ? e.occurred_at.substring(0, 16) : '',
        })),
    );
  }

  goBack(): void {
    const chatId = this.timeline()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  addEvent(): void {
    this.events.update((evts) => [
      ...evts,
      { uid: crypto.randomUUID(), title: '', description: '', occurred_label: '', occurred_at: '' },
    ]);
  }

  deleteEvent(idx: number): void {
    this.events.update((evts) => evts.filter((_, i) => i !== idx));
  }

  updateField(idx: number, field: keyof EditEvent, e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.events.update((evts) => {
      const arr = [...evts];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  moveEvent(idx: number, dir: -1 | 1): void {
    const newIdx = idx + dir;
    this.events.update((evts) => {
      if (newIdx < 0 || newIdx >= evts.length) return evts;
      const arr = [...evts];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  save(): void {
    const t = this.timeline();
    if (!t) return;
    const title = this.editTitle().trim();
    if (!title) { this.toast.show('El título no puede estar vacío.', 'error'); return; }
    const eventsPayload = this.events().map((e, i) => ({
      title: e.title,
      description: e.description,
      occurred_label: e.occurred_label,
      occurred_at: e.occurred_at || null,
      position: i + 1,
    }));
    this.saving.set(true);
    this.http.patchTimeline(t.id, { title, summary: this.editSummary(), events: eventsPayload })
      .pipe(take(1)).subscribe({
        next: (updated) => {
          this.timeline.set(updated);
          this._syncFromTimeline(updated);
          this.saving.set(false);
          this.toast.show('Línea de tiempo guardada.', 'success');
        },
        error: () => { this.saving.set(false); this.toast.show('No se pudo guardar.', 'error'); },
      });
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
