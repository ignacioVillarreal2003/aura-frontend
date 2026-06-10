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
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly questionKinds: { value: QuizQuestionKind; label: string; icon: string }[] = [
    { value: 'single', label: 'Única', icon: 'pi-circle' },
    { value: 'multiple', label: 'Múltiple', icon: 'pi-check-square' },
    { value: 'boolean', label: 'V/F', icon: 'pi-times-circle' },
  ];

  readonly sortedQuestions = computed(() => {
    const q = this.quiz();
    if (!q) return [];
    return [...q.questions]
      .sort((a, b) => a.position - b.position)
      .map((qq) => ({
        ...qq,
        options: [...qq.options].sort((a, b) => a.position - b.position),
      }));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getQuiz(id).pipe(take(1)).subscribe({
      next: (q) => {
        this.quiz.set(q);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar el quiz.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
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

  kindLabel(kind: QuizQuestionKind): string {
    return this.questionKinds.find((k) => k.value === kind)?.label ?? kind;
  }

  kindIcon(kind: QuizQuestionKind): string {
    return this.questionKinds.find((k) => k.value === kind)?.icon ?? 'pi-circle';
  }
}
