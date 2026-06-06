import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type {
  LessonsLearnedDto,
  LessonsLearnedCategory,
} from '@aura-types/aura-chat-service.types';

interface EditItem {
  uid: string;
  category: LessonsLearnedCategory;
  observation: string;
  discussion: string;
  recommendation: string;
}

@Component({
  selector: 'app-lessons-learned-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lessons-learned-editor.html',
  styleUrl: './lessons-learned-editor.css',
})
export class LessonsLearnedEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly doc = signal<LessonsLearnedDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly editTitle = signal('');
  readonly editContext = signal('');
  readonly items = signal<EditItem[]>([]);

  readonly categories: { value: LessonsLearnedCategory; label: string; icon: string }[] = [
    { value: 'sustain', label: 'Sostener', icon: 'pi-check-circle' },
    { value: 'improve', label: 'Mejorar', icon: 'pi-arrow-up-right' },
    { value: 'recommendation', label: 'Recomendación', icon: 'pi-star' },
  ];

  readonly sustainCount = computed(() => this.items().filter((i) => i.category === 'sustain').length);
  readonly improveCount = computed(() => this.items().filter((i) => i.category === 'improve').length);
  readonly recCount = computed(() => this.items().filter((i) => i.category === 'recommendation').length);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getLessonsLearned(id).pipe(take(1)).subscribe({
      next: (d) => {
        this.doc.set(d);
        this._sync(d);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar las lecciones aprendidas.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  private _sync(d: LessonsLearnedDto): void {
    this.editTitle.set(d.title);
    this.editContext.set(d.context);
    this.items.set(
      [...d.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          uid: item.id.toString(),
          category: item.category,
          observation: item.observation,
          discussion: item.discussion,
          recommendation: item.recommendation,
        })),
    );
  }

  goBack(): void {
    const chatId = this.doc()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  addItem(category: LessonsLearnedCategory = 'sustain'): void {
    this.items.update((items) => [
      ...items,
      { uid: crypto.randomUUID(), category, observation: '', discussion: '', recommendation: '' },
    ]);
  }

  deleteItem(idx: number): void {
    this.items.update((items) => items.filter((_, i) => i !== idx));
  }

  setCategory(idx: number, category: LessonsLearnedCategory): void {
    this.items.update((items) => {
      const arr = [...items];
      arr[idx] = { ...arr[idx], category };
      return arr;
    });
  }

  updateField(idx: number, field: 'observation' | 'discussion' | 'recommendation', e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.items.update((items) => {
      const arr = [...items];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  save(): void {
    const d = this.doc();
    if (!d) return;
    const title = this.editTitle().trim();
    if (!title) { this.toast.show('El título no puede estar vacío.', 'error'); return; }
    const items = this.items().map((item, i) => ({
      category: item.category,
      observation: item.observation,
      discussion: item.discussion,
      recommendation: item.recommendation,
      position: i + 1,
    }));
    this.saving.set(true);
    this.http.patchLessonsLearned(d.id, { title, context: this.editContext(), items })
      .pipe(take(1)).subscribe({
        next: (updated) => {
          this.doc.set(updated);
          this._sync(updated);
          this.saving.set(false);
          this.toast.show('Lecciones aprendidas guardadas.', 'success');
        },
        error: () => { this.saving.set(false); this.toast.show('No se pudo guardar.', 'error'); },
      });
  }

  export(format: 'pdf' | 'markdown'): void {
    const d = this.doc();
    if (!d || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (d.title || `lecciones-${d.id}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const req$ = format === 'pdf' ? this.http.exportLessonsLearnedPdf(d.id) : this.http.exportLessonsLearnedMarkdown(d.id);
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

  categoryLabel(cat: LessonsLearnedCategory): string {
    return this.categories.find((c) => c.value === cat)?.label ?? cat;
  }

  categoryIcon(cat: LessonsLearnedCategory): string {
    return this.categories.find((c) => c.value === cat)?.icon ?? 'pi-circle';
  }
}
