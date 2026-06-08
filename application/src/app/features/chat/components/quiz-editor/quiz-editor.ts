import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type {
  QuizDto,
  QuizQuestionKind,
} from '@aura-types/aura-chat-service.types';

interface EditOption {
  uid: string;
  text: string;
  is_correct: boolean;
}

interface EditQuestion {
  uid: string;
  text: string;
  kind: QuizQuestionKind;
  explanation: string;
  options: EditOption[];
}

@Component({
  selector: 'app-quiz-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-editor.html',
  styleUrl: './quiz-editor.css',
})
export class QuizEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly quiz = signal<QuizDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly editTitle = signal('');
  readonly editInstructions = signal('');
  readonly editPassScore = signal<string>('');
  readonly questions = signal<EditQuestion[]>([]);

  readonly questionKinds: { value: QuizQuestionKind; label: string; icon: string }[] = [
    { value: 'single', label: 'Única', icon: 'pi-circle' },
    { value: 'multiple', label: 'Múltiple', icon: 'pi-check-square' },
    { value: 'boolean', label: 'V/F', icon: 'pi-times-circle' },
    { value: 'open', label: 'Abierta', icon: 'pi-pencil' },
  ];

  readonly hasChanges = computed(() => {
    const q = this.quiz();
    if (!q) return false;
    if (this.editTitle().trim() !== q.title) return true;
    if (this.editInstructions() !== q.instructions) return true;
    const ps = this.editPassScore();
    const origPs = q.pass_score == null ? '' : String(q.pass_score);
    if (ps !== origPs) return true;
    return true; // simplified — always allow save when quiz loaded
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getQuiz(id).pipe(take(1)).subscribe({
      next: (q) => {
        this.quiz.set(q);
        this._syncFromQuiz(q);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar el quiz.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  private _syncFromQuiz(q: QuizDto): void {
    this.editTitle.set(q.title);
    this.editInstructions.set(q.instructions);
    this.editPassScore.set(q.pass_score == null ? '' : String(q.pass_score));
    this.questions.set(
      [...q.questions]
        .sort((a, b) => a.position - b.position)
        .map((qq) => ({
          uid: qq.id.toString(),
          text: qq.text,
          kind: qq.kind,
          explanation: qq.explanation,
          options: [...qq.options]
            .sort((a, b) => a.position - b.position)
            .map((o) => ({ uid: o.id.toString(), text: o.text, is_correct: false })),
        })),
    );
  }

  goBack(): void {
    const chatId = this.quiz()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  addQuestion(): void {
    const newQ: EditQuestion = {
      uid: crypto.randomUUID(),
      text: '',
      kind: 'single',
      explanation: '',
      options: [
        { uid: crypto.randomUUID(), text: '', is_correct: false },
        { uid: crypto.randomUUID(), text: '', is_correct: false },
      ],
    };
    this.questions.update((qs) => [...qs, newQ]);
  }

  deleteQuestion(idx: number): void {
    this.questions.update((qs) => qs.filter((_, i) => i !== idx));
  }

  updateQuestionText(idx: number, e: Event): void {
    const text = (e.target as HTMLTextAreaElement).value;
    this.questions.update((qs) => {
      const arr = [...qs];
      arr[idx] = { ...arr[idx], text };
      return arr;
    });
  }

  updateQuestionExplanation(idx: number, e: Event): void {
    const explanation = (e.target as HTMLInputElement).value;
    this.questions.update((qs) => {
      const arr = [...qs];
      arr[idx] = { ...arr[idx], explanation };
      return arr;
    });
  }

  setQuestionKind(idx: number, kind: QuizQuestionKind): void {
    this.questions.update((qs) => {
      const arr = [...qs];
      const q = arr[idx];
      let opts = q.options;
      if (kind === 'boolean') {
        opts = [
          { uid: crypto.randomUUID(), text: 'Verdadero', is_correct: true },
          { uid: crypto.randomUUID(), text: 'Falso', is_correct: false },
        ];
      } else if (kind === 'open') {
        opts = [];
      } else if (opts.length === 0) {
        opts = [
          { uid: crypto.randomUUID(), text: '', is_correct: false },
          { uid: crypto.randomUUID(), text: '', is_correct: false },
        ];
      }
      arr[idx] = { ...q, kind, options: opts };
      return arr;
    });
  }

  addOption(qIdx: number): void {
    this.questions.update((qs) => {
      const arr = [...qs];
      const q = arr[qIdx];
      arr[qIdx] = { ...q, options: [...q.options, { uid: crypto.randomUUID(), text: '', is_correct: false }] };
      return arr;
    });
  }

  deleteOption(qIdx: number, oIdx: number): void {
    this.questions.update((qs) => {
      const arr = [...qs];
      arr[qIdx] = { ...arr[qIdx], options: arr[qIdx].options.filter((_, i) => i !== oIdx) };
      return arr;
    });
  }

  updateOptionText(qIdx: number, oIdx: number, e: Event): void {
    const text = (e.target as HTMLInputElement).value;
    this.questions.update((qs) => {
      const arr = [...qs];
      const opts = [...arr[qIdx].options];
      opts[oIdx] = { ...opts[oIdx], text };
      arr[qIdx] = { ...arr[qIdx], options: opts };
      return arr;
    });
  }

  toggleOptionCorrect(qIdx: number, oIdx: number): void {
    this.questions.update((qs) => {
      const arr = [...qs];
      const q = arr[qIdx];
      const opts = q.options.map((o, i) => {
        if (q.kind === 'single' || q.kind === 'boolean') {
          return { ...o, is_correct: i === oIdx };
        }
        return i === oIdx ? { ...o, is_correct: !o.is_correct } : o;
      });
      arr[qIdx] = { ...q, options: opts };
      return arr;
    });
  }

  save(): void {
    const q = this.quiz();
    if (!q) return;
    const title = this.editTitle().trim();
    if (!title) { this.toast.show('El título no puede estar vacío.', 'error'); return; }
    const psRaw = this.editPassScore().trim();
    const passScore = psRaw === '' ? null : Number(psRaw);
    if (psRaw !== '' && (isNaN(passScore!) || passScore! < 0 || passScore! > 100)) {
      this.toast.show('El puntaje de aprobación debe ser entre 0 y 100.', 'error');
      return;
    }
    const questions = this.questions().map((qq, qi) => ({
      text: qq.text,
      kind: qq.kind,
      explanation: qq.explanation,
      position: qi + 1,
      options: qq.options.map((o, oi) => ({
        text: o.text,
        is_correct: o.is_correct,
        position: oi + 1,
      })),
    }));
    this.saving.set(true);
    this.http.patchQuiz(q.id, {
      title,
      instructions: this.editInstructions(),
      pass_score: passScore,
      questions,
    }).pipe(take(1)).subscribe({
      next: (updated) => {
        this.quiz.set(updated);
        this._syncFromQuiz(updated);
        this.saving.set(false);
        this.toast.show('Quiz guardado.', 'success');
      },
      error: () => { this.saving.set(false); this.toast.show('No se pudo guardar el quiz.', 'error'); },
    });
  }

  export(format: 'pdf' | 'markdown'): void {
    const q = this.quiz();
    if (!q || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (q.title || `quiz-${q.id}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const req$ = format === 'pdf' ? this.http.exportQuizPdf(q.id) : this.http.exportQuizMarkdown(q.id);
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

  kindLabel(kind: QuizQuestionKind): string {
    return this.questionKinds.find((k) => k.value === kind)?.label ?? kind;
  }

  kindIcon(kind: QuizQuestionKind): string {
    return this.questionKinds.find((k) => k.value === kind)?.icon ?? 'pi-circle';
  }

  hasOptions(kind: QuizQuestionKind): boolean {
    return kind !== 'open';
  }
}
