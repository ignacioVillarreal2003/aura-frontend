import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import type { DocumentSummaryDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-document-summary-editor',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './document-summary-editor.html',
  styleUrl: './document-summary-editor.css',
})
export class DocumentSummaryEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly summary = signal<DocumentSummaryDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getDocumentSummary(id).pipe(take(1)).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar el resumen.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  goBack(): void {
    const chatId = this.summary()?.source_chat_id;
    if (chatId) void this.router.navigate(['/main-container', 'chat', chatId]);
    else void this.router.navigate(['/main-container', 'chat-home']);
  }

  export(format: 'pdf' | 'markdown'): void {
    const s = this.summary();
    if (!s || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const obs$ = format === 'pdf'
      ? this.http.exportDocumentSummaryPdf(s.id)
      : this.http.exportDocumentSummaryMarkdown(s.id);
    const ext = format === 'pdf' ? 'pdf' : 'md';
    obs$.pipe(take(1)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resumen-${s.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.exportingAs.set(null);
      },
      error: () => {
        this.exportingAs.set(null);
        this.toast.show('No se pudo exportar.', 'error');
      },
    });
  }
}
