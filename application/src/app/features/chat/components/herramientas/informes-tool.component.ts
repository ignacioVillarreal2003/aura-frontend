import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuraLlmServiceHttp, type ReportMessage, type ReportType, type ReportMode } from '../../../../core/services/http-services/aura-llm-service-http.service';
import { AuraChatServiceHttp } from '../../../../core/services/http-services/aura-chat-service-http.service';

type ReportTypeOption = { value: ReportType; label: string; description: string };

const REPORT_TYPES: readonly ReportTypeOption[] = [
  {
    value: 'SITREP',
    label: 'SITREP',
    description: 'Informe de Situación — estado actual de la operación.',
  },
  {
    value: 'INTSUM',
    label: 'INTSUM',
    description: 'Resumen de Inteligencia — análisis de la amenaza.',
  },
  {
    value: 'OPORD',
    label: 'OPORD',
    description: 'Orden de Operaciones — directiva completa de misión.',
  },
] as const;

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-informes-tool',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './informes-tool.component.html',
  styleUrl: './informes-tool.component.css',
})
export class InformesToolComponent {
  private readonly llmHttp = inject(AuraLlmServiceHttp);
  private readonly chatHttp = inject(AuraChatServiceHttp);

  readonly reportTypes: readonly ReportTypeOption[] = REPORT_TYPES;

  readonly selectedType = signal<ReportType>('SITREP');
  readonly selectedMode = signal<ReportMode>('direct');
  readonly userInput = signal('');
  readonly refineInput = signal('');

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly exporting = signal<'pdf' | 'markdown' | null>(null);
  readonly error = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly generatedContent = signal<string | null>(null);
  readonly savedReportId = signal<number | null>(null);

  private conversationHistory = signal<readonly ReportMessage[]>([]);

  readonly hasGenerated = computed(() => this.generatedContent() !== null);
  readonly canGenerate = computed(() => this.userInput().trim().length > 0 && !this.loading());
  readonly canRefine = computed(() => this.refineInput().trim().length > 0 && !this.loading());

  selectType(type: ReportType): void {
    this.selectedType.set(type);
  }

  selectMode(mode: ReportMode): void {
    this.selectedMode.set(mode);
  }

  onInputChange(value: string): void {
    this.userInput.set(value);
  }

  onRefineChange(value: string): void {
    this.refineInput.set(value);
  }

  generate(): void {
    const content = this.userInput().trim();
    if (!content) return;

    const messages: ReportMessage[] = [{ role: 'human', content }];
    this._callGenerate(messages);
  }

  refine(): void {
    const instruction = this.refineInput().trim();
    if (!instruction || !this.hasGenerated()) return;

    const history = [...this.conversationHistory()];
    const messages: readonly ReportMessage[] = [...history, { role: 'human', content: instruction }];
    this._callGenerate(messages);
    this.refineInput.set('');
  }

  private _callGenerate(messages: readonly ReportMessage[]): void {
    this.loading.set(true);
    this.error.set(null);
    this.saveSuccess.set(false);
    this.savedReportId.set(null);

    this.llmHttp
      .generateReport({
        report_type: this.selectedType(),
        mode: this.selectedMode(),
        messages,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.generatedContent.set(res.content);
          this.conversationHistory.set(res.messages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            'No se pudo generar el informe. Verificá que el LLM service esté activo y que tengas el permiso LLM_REPORT_GENERATE.'
          );
        },
      });
  }

  saveReport(): void {
    const content = this.generatedContent();
    if (!content) return;

    this.saving.set(true);
    this.saveSuccess.set(false);

    this.chatHttp
      .createReport({
        type: this.selectedType(),
        content,
        mode: this.selectedMode(),
        metadata: {},
      })
      .subscribe({
        next: (report) => {
          this.saving.set(false);
          this.saveSuccess.set(true);
          this.savedReportId.set(report.id);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo guardar el informe.');
        },
      });
  }

  exportPdf(): void {
    const reportId = this.savedReportId();
    if (!reportId) {
      this.error.set('Guardá el informe primero para exportar como PDF.');
      return;
    }
    this.exporting.set('pdf');
    this.chatHttp.exportReportPdf(reportId).subscribe({
      next: (blob) => {
        this.exporting.set(null);
        triggerDownload(blob, `${this.selectedType()}_informe.pdf`);
      },
      error: () => {
        this.exporting.set(null);
        this.error.set('Error al exportar el PDF.');
      },
    });
  }

  exportMarkdown(): void {
    const content = this.generatedContent();
    if (!content) return;

    const reportId = this.savedReportId();
    if (reportId) {
      this.exporting.set('markdown');
      this.chatHttp.exportReportMarkdown(reportId).subscribe({
        next: (blob) => {
          this.exporting.set(null);
          triggerDownload(blob, `${this.selectedType()}_informe.md`);
        },
        error: () => {
          this.exporting.set(null);
          this.error.set('Error al exportar Markdown.');
        },
      });
    } else {
      const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
      triggerDownload(blob, `${this.selectedType()}_informe.md`);
    }
  }

  reset(): void {
    this.userInput.set('');
    this.refineInput.set('');
    this.generatedContent.set(null);
    this.conversationHistory.set([]);
    this.error.set(null);
    this.saveSuccess.set(false);
    this.savedReportId.set(null);
  }

  autosizeTextarea(el: HTMLTextAreaElement, maxPx = 400): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
  }
}
