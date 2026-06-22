import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { ArtifactHeader } from '../../../../shared/components/artifact-header/artifact-header';
import type { ChecklistDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-checklist-editor',
  standalone: true,
  imports: [CommonModule, ArtifactHeader],
  templateUrl: './checklist-editor.html',
  styleUrl: './checklist-editor.css',
})
export class ChecklistEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly checklist = signal<ChecklistDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  readonly checkedCount = computed(() => {
    const c = this.checklist();
    if (!c) return 0;
    return c.sections.reduce((acc, s) => acc + s.items.filter((i) => i.is_checked).length, 0);
  });

  readonly totalCount = computed(() => {
    const c = this.checklist();
    if (!c) return 0;
    return c.sections.reduce((acc, s) => acc + s.items.length, 0);
  });

  readonly progressPct = computed(() => {
    const t = this.totalCount();
    return t === 0 ? 0 : Math.round((this.checkedCount() / t) * 100);
  });

  readonly sortedSections = computed(() => {
    const c = this.checklist();
    if (!c) return [];
    return [...c.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        ...s,
        items: [...s.items].sort((a, b) => a.position - b.position),
      }));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getChecklist(id).pipe(take(1)).subscribe({
      next: (c) => {
        this.checklist.set(c);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la checklist.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  goBack(): void {
    const chatId = this.checklist()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  export(format: 'pdf' | 'markdown'): void {
    const c = this.checklist();
    if (!c || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (c.title || `checklist-${c.id}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const req$ = format === 'pdf' ? this.http.exportChecklistPdf(c.id) : this.http.exportChecklistMarkdown(c.id);
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
