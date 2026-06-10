import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import type { DocumentActionDto, DocumentActionType } from '@aura-types/aura-chat-service.types';

const ACTION_LABELS: Record<DocumentActionType, string> = {
  summarize: 'Resumir',
  essay: 'Ensayo',
  key_points: 'Puntos clave',
  compare: 'Comparar',
  analyze: 'Analizar',
  explain: 'Explicar',
  report: 'Informe',
};

@Component({
  selector: 'app-document-action-editor',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './document-action-editor.html',
  styleUrl: './document-action-editor.css',
})
export class DocumentActionEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly action = signal<DocumentActionDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getDocumentAction(id).pipe(take(1)).subscribe({
      next: (a) => {
        this.action.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la acción.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  actionLabel(type: DocumentActionType | null): string {
    if (!type) return 'Automática';
    return ACTION_LABELS[type] ?? type;
  }

  goBack(): void {
    const chatId = this.action()?.source_chat_id;
    if (chatId) void this.router.navigate(['/main-container', 'chat', chatId]);
    else void this.router.navigate(['/main-container', 'chat-home']);
  }

  export(format: 'pdf' | 'markdown'): void {
    const a = this.action();
    if (!a || this.exportingAs() !== null) return;
    this.exportingAs.set(format);
    const obs$ = format === 'pdf'
      ? this.http.exportDocumentActionPdf(a.id)
      : this.http.exportDocumentActionMarkdown(a.id);
    const ext = format === 'pdf' ? 'pdf' : 'md';
    obs$.pipe(take(1)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `accion-${a.id}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
