import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { ArtifactHeader } from '../../../../shared/components/artifact-header/artifact-header';
import type { QuizDto, QuizOptionDto, QuizQuestionDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-quiz-editor',
  standalone: true,
  imports: [CommonModule, ArtifactHeader],
  templateUrl: './quiz-editor.html',
  styleUrl: './quiz-editor.css',
})
export class QuizEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly quiz = signal<QuizDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly activeIndex = signal(0);
  readonly answering = signal(false);
  readonly resetting = signal(false);
  readonly showExplanation = signal(false);

  readonly questions = computed(() => {
    const q = this.quiz();
    if (!q) return [];
    return [...q.questions]
      .sort((a, b) => a.position - b.position)
      .map((qq) => ({ ...qq, options: [...qq.options].sort((a, b) => a.position - b.position) }));
  });

  private readonly safeIndex = computed(() => {
    const n = this.questions().length;
    if (n === 0) return 0;
    return ((this.activeIndex() % n) + n) % n;
  });

  readonly displayIndex = computed(() => this.safeIndex());
  readonly active = computed(() => this.questions()[this.safeIndex()] ?? null);
  readonly activeList = computed(() => {
    const a = this.active();
    return a ? [a] : [];
  });

  readonly total = computed(() => this.questions().length);
  readonly answeredCount = computed(() => this.questions().filter((q) => q.selected_option_id != null).length);
  readonly correctCount = computed(() =>
    this.questions().filter((q) => q.selected_option_id != null
      && q.correct_option_ids.includes(q.selected_option_id)).length,
  );
  readonly scorePct = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : Math.round((this.correctCount() / t) * 100);
  });
  readonly allAnswered = computed(() => this.total() > 0 && this.answeredCount() === this.total());

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getQuiz(id).pipe(take(1)).subscribe({
      next: (q) => { this.quiz.set(q); this.loading.set(false); },
      error: () => {
        this.toast.show('No se pudo cargar el quiz.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  isAnswered(q: QuizQuestionDto): boolean {
    return q.selected_option_id != null;
  }

  optionState(q: QuizQuestionDto, opt: QuizOptionDto): 'idle' | 'correct' | 'wrong' | 'muted' {
    if (!this.isAnswered(q)) return 'idle';
    if (q.correct_option_ids.includes(opt.id)) return 'correct';
    if (q.selected_option_id === opt.id) return 'wrong';
    return 'muted';
  }

  selectOption(q: QuizQuestionDto, opt: QuizOptionDto): void {
    const quiz = this.quiz();
    if (!quiz || this.answering() || this.isAnswered(q)) return;
    this.answering.set(true);
    this.http.answerQuizQuestion(quiz.id, q.id, opt.id).pipe(take(1)).subscribe({
      next: (res) => {
        this.patchQuestion(q.id, res.selected_option_id, res.correct_option_ids);
        this.answering.set(false);
        this.toast.show(res.is_correct ? '¡Correcto!' : 'Incorrecto', res.is_correct ? 'success' : 'error');
      },
      error: () => {
        this.answering.set(false);
        this.toast.show('No se pudo guardar la respuesta.', 'error');
      },
    });
  }

  private patchQuestion(questionId: number, selectedId: number, correctIds: readonly number[]): void {
    const q = this.quiz();
    if (!q) return;
    this.quiz.set({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === questionId
          ? { ...qq, selected_option_id: selectedId, correct_option_ids: correctIds }
          : qq,
      ),
    });
  }

  toggleExplanation(): void {
    this.showExplanation.update((v) => !v);
  }

  prev(): void { this.go(this.safeIndex() - 1); }
  next(): void { this.go(this.safeIndex() + 1); }
  private go(i: number): void {
    const n = this.total();
    if (n === 0) return;
    this.activeIndex.set(((i % n) + n) % n);
    this.showExplanation.set(false);
  }

  reset(): void {
    const q = this.quiz();
    if (!q || this.resetting()) return;
    this.resetting.set(true);
    this.http.resetQuiz(q.id).pipe(take(1)).subscribe({
      next: (fresh) => {
        this.quiz.set(fresh);
        this.activeIndex.set(0);
        this.showExplanation.set(false);
        this.resetting.set(false);
        this.toast.show('Cuestionario reiniciado.', 'success');
      },
      error: () => {
        this.resetting.set(false);
        this.toast.show('No se pudo reiniciar.', 'error');
      },
    });
  }

  goBack(): void {
    const chatId = this.quiz()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
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
}
