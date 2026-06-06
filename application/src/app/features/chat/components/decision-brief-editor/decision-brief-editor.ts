import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { DecisionBriefDto } from '@aura-types/aura-chat-service.types';

interface EditOption {
  uid: string;
  title: string;
  description: string;
  pros: string;
  cons: string;
  is_recommended: boolean;
}

@Component({
  selector: 'app-decision-brief-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './decision-brief-editor.html',
  styleUrl: './decision-brief-editor.css',
})
export class DecisionBriefEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly brief = signal<DecisionBriefDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly editTitle = signal('');
  readonly editProblem = signal('');
  readonly editContext = signal('');
  readonly editRisks = signal('');
  readonly editRecommendation = signal('');
  readonly options = signal<EditOption[]>([]);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getDecisionBrief(id).pipe(take(1)).subscribe({
      next: (b) => {
        this.brief.set(b);
        this._sync(b);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la decisión.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  private _sync(b: DecisionBriefDto): void {
    this.editTitle.set(b.title);
    this.editProblem.set(b.problem);
    this.editContext.set(b.context);
    this.editRisks.set(b.risks);
    this.editRecommendation.set(b.recommendation);
    this.options.set(
      [...b.options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          uid: o.id.toString(),
          title: o.title,
          description: o.description,
          pros: o.pros,
          cons: o.cons,
          is_recommended: o.is_recommended,
        })),
    );
  }

  goBack(): void {
    const chatId = this.brief()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  addOption(): void {
    this.options.update((opts) => [
      ...opts,
      { uid: crypto.randomUUID(), title: '', description: '', pros: '', cons: '', is_recommended: false },
    ]);
  }

  deleteOption(idx: number): void {
    this.options.update((opts) => opts.filter((_, i) => i !== idx));
  }

  updateOptionField(idx: number, field: keyof EditOption, e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.options.update((opts) => {
      const arr = [...opts];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  toggleRecommended(idx: number): void {
    this.options.update((opts) => {
      return opts.map((o, i) => ({ ...o, is_recommended: i === idx ? !o.is_recommended : o.is_recommended }));
    });
  }

  save(): void {
    const b = this.brief();
    if (!b) return;
    const title = this.editTitle().trim();
    if (!title) { this.toast.show('El título no puede estar vacío.', 'error'); return; }
    const options = this.options().map((o, i) => ({
      title: o.title,
      description: o.description,
      pros: o.pros,
      cons: o.cons,
      is_recommended: o.is_recommended,
      position: i + 1,
    }));
    this.saving.set(true);
    this.http.patchDecisionBrief(b.id, {
      title,
      problem: this.editProblem(),
      context: this.editContext(),
      risks: this.editRisks(),
      recommendation: this.editRecommendation(),
      options,
    }).pipe(take(1)).subscribe({
      next: (updated) => {
        this.brief.set(updated);
        this._sync(updated);
        this.saving.set(false);
        this.toast.show('Decisión guardada.', 'success');
      },
      error: () => { this.saving.set(false); this.toast.show('No se pudo guardar.', 'error'); },
    });
  }

  export(format: 'pdf' | 'markdown'): void {
    const b = this.brief();
    if (!b || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (b.title || `decision-${b.id}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const req$ = format === 'pdf' ? this.http.exportDecisionBriefPdf(b.id) : this.http.exportDecisionBriefMarkdown(b.id);
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
