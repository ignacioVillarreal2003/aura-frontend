import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { DecisionBriefDto } from '@aura-types/aura-chat-service.types';

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
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly sortedOptions = computed(() => {
    const b = this.brief();
    if (!b) return [];
    return [...b.options].sort((a, b) => a.position - b.position);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getDecisionBrief(id).pipe(take(1)).subscribe({
      next: (b) => {
        this.brief.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la decisión.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  goBack(): void {
    const chatId = this.brief()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
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
