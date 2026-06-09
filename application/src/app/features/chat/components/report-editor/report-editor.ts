import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import type { ReportDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-report-editor',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './report-editor.html',
  styleUrl: './report-editor.css',
})
export class ReportEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly report = signal<ReportDto | null>(null);
  readonly loading = signal(true);
  readonly editTitle = signal('');
  readonly editContent = signal('');
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);
  readonly viewMode = signal<'edit' | 'preview'>('preview');

  readonly hasChanges = computed(() => {
    const r = this.report();
    if (!r) return false;
    return this.editTitle().trim() !== r.title || this.editContent() !== r.content;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      void this.router.navigate(['/main-container', 'chat-home']);
      return;
    }
    this.http.getReport(id).pipe(take(1)).subscribe({
      next: (r) => {
        this.report.set(r);
        this.editTitle.set(r.title);
        this.editContent.set(r.content);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar el informe.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  goBack(): void {
    const chatId = this.report()?.source_chat_id;
    if (chatId) {
      void this.router.navigate(['/main-container', 'chat', chatId]);
    } else {
      void this.router.navigate(['/main-container', 'chat-home']);
    }
  }

  save(): void {
    const r = this.report();
    if (!r) return;
    const t = this.editTitle().trim();
    const c = this.editContent().trim();
    if (!t || !c) {
      this.toast.show('El título y el contenido no pueden estar vacíos.', 'error');
      return;
    }
    this.saving.set(true);
    this.http.patchReport(r.id, { title: t, content: c }).pipe(take(1)).subscribe({
      next: (updated) => {
        this.report.set(updated);
        this.editTitle.set(updated.title);
        this.editContent.set(updated.content);
        this.saving.set(false);
        this.toast.show('Informe guardado.', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('No se pudo guardar el informe.', 'error');
      },
    });
  }

  export(format: 'pdf' | 'markdown'): void {
    const r = this.report();
    if (!r || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const slug = (r.title || `informe-${r.id}`)
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const req$ =
      format === 'pdf'
        ? this.http.exportReportPdf(r.id)
        : this.http.exportReportMarkdown(r.id);
    req$.pipe(take(1)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}.${format === 'pdf' ? 'pdf' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.exportingAs.set(null);
      },
      error: () => {
        this.exportingAs.set(null);
        this.toast.show('No se pudo exportar el informe.', 'error');
      },
    });
  }
}
