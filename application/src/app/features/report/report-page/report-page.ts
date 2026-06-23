import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { ReportDocument } from '../components/report-document/report-document';
import { ArtifactHeader } from '../../../shared/components/artifact-header/artifact-header';
import type { ReportDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule, ReportDocument, ArtifactHeader],
  templateUrl: './report-page.html',
  styleUrl: './report-page.css',
})
export class ReportPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  readonly report = signal<ReportDto | null>(null);
  readonly loading = signal(true);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      void this.router.navigate(['/main-container', 'chat-home']);
      return;
    }
    this.http.getReport(id).pipe(take(1)).subscribe({
      next: (r) => {
        this.report.set(r);
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
