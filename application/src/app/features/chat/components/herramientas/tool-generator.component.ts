import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { UserState } from '@core/state/user.state';
import type {
  ChecklistDto,
  ChecklistItemDto,
  ChecklistMode,
  ReportDto,
  ReportMode,
  ReportType,
} from '@aura-types/aura-chat-service.types';

type GeneratorKind = ReportType | 'CHECKLIST';
type GenerationMode = ReportMode | ChecklistMode;

interface GuidedField {
  readonly key: string;
  readonly label: string;
  readonly placeholder: string;
  readonly large?: boolean;
}

interface KindOption {
  readonly value: GeneratorKind;
  readonly label: string;
  readonly description: string;
  readonly fields: readonly GuidedField[];
  readonly permission: string;
}

const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: 'SITREP',
    label: 'SITREP — Informe de situación',
    description: 'Estado actual de la operación.',
    permission: 'LLM_REPORT_GENERATE',
    fields: [
      { key: 'Situación general', label: 'Situación general', placeholder: 'Resumen de la situación actual…', large: true },
      { key: 'Unidades involucradas', label: 'Unidades involucradas', placeholder: 'Unidades, efectivos, medios…' },
      { key: 'Área de operaciones', label: 'Área de operaciones', placeholder: 'Ubicación, sector, coordenadas…' },
      { key: 'Actividad enemiga', label: 'Actividad enemiga', placeholder: 'Movimientos o amenazas observadas…' },
    ],
  },
  {
    value: 'INTSUM',
    label: 'INTSUM — Resumen de inteligencia',
    description: 'Análisis de la amenaza.',
    permission: 'LLM_REPORT_GENERATE',
    fields: [
      { key: 'Período cubierto', label: 'Período cubierto', placeholder: 'Rango temporal del resumen…' },
      { key: 'Amenaza / enemigo', label: 'Amenaza / enemigo', placeholder: 'Descripción de la amenaza…', large: true },
      { key: 'Eventos relevantes', label: 'Eventos relevantes', placeholder: 'Hechos destacados del período…' },
      { key: 'Evaluación', label: 'Evaluación', placeholder: 'Valoración y pronóstico…' },
    ],
  },
  {
    value: 'OPORD',
    label: 'OPORD — Orden de operaciones',
    description: 'Directiva completa de misión.',
    permission: 'LLM_REPORT_GENERATE',
    fields: [
      { key: 'Misión', label: 'Misión', placeholder: 'Quién, qué, cuándo, dónde y por qué…', large: true },
      { key: 'Situación', label: 'Situación', placeholder: 'Fuerzas propias y enemigas…' },
      { key: 'Ejecución', label: 'Ejecución', placeholder: 'Concepto de la operación y tareas…' },
      { key: 'Apoyo logístico', label: 'Apoyo logístico', placeholder: 'Abastecimiento, transporte, sanidad…' },
      { key: 'Mando y comunicaciones', label: 'Mando y comunicaciones', placeholder: 'Cadena de mando y medios…' },
    ],
  },
  {
    value: 'CHECKLIST',
    label: 'Checklist — Desde procedimiento',
    description: 'Convierte un SOP o manual en una checklist verificable.',
    permission: 'LLM_CHECKLIST_GENERATE',
    fields: [
      { key: 'Procedimiento', label: 'Procedimiento / SOP', placeholder: 'Pegá o describí el procedimiento a convertir en checklist…', large: true },
    ],
  },
];

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-tool-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tool-generator.component.html',
  styleUrl: './tool-generator.component.css',
})
export class ToolGeneratorComponent {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);
  private readonly userState = inject(UserState);

  readonly chatId = input<number | null>(null);
  readonly initialKind = input<GeneratorKind | null>(null);
  readonly created = output<void>();

  private readonly permissions = computed(() => this.userState.user()?.permissions ?? []);

  readonly kindOptions = computed<readonly KindOption[]>(() =>
    KIND_OPTIONS.filter((o) => this.permissions().includes(o.permission)),
  );

  readonly selectedKind = signal<GeneratorKind>('SITREP');

  constructor() {
    effect(() => {
      const kind = this.initialKind();
      if (kind && KIND_OPTIONS.some((o) => o.value === kind)) {
        untracked(() => this.selectedKind.set(kind));
      }
    });
  }
  readonly selectedMode = signal<GenerationMode>('direct');
  readonly fieldValues = signal<Record<string, string>>({});

  readonly loading = signal(false);
  readonly exporting = signal<'pdf' | 'markdown' | null>(null);
  readonly error = signal<string | null>(null);

  readonly generatedReport = signal<ReportDto | null>(null);
  readonly generatedChecklist = signal<ChecklistDto | null>(null);

  readonly activeOption = computed<KindOption | undefined>(() =>
    this.kindOptions().find((o) => o.value === this.selectedKind()),
  );

  readonly isChecklist = computed(() => this.selectedKind() === 'CHECKLIST');

  readonly composedMessage = computed(() => {
    const option = this.activeOption();
    if (!option) return '';
    const values = this.fieldValues();
    const parts: string[] = [];
    for (const field of option.fields) {
      const value = (values[field.key] ?? '').trim();
      if (value) {
        parts.push(option.fields.length > 1 ? `## ${field.label}\n${value}` : value);
      }
    }
    return parts.join('\n\n');
  });

  readonly canGenerate = computed(() => this.composedMessage().length > 0 && !this.loading());

  readonly hasResult = computed(() => this.generatedReport() !== null || this.generatedChecklist() !== null);

  readonly checklistItems = computed<readonly ChecklistItemDto[]>(() => this.generatedChecklist()?.items ?? []);

  selectKind(kind: GeneratorKind): void {
    if (this.loading()) return;
    this.selectedKind.set(kind);
    this.fieldValues.set({});
    this.resetResult();
  }

  onKindSelectChange(value: string): void {
    this.selectKind(value as GeneratorKind);
  }

  selectMode(mode: GenerationMode): void {
    this.selectedMode.set(mode);
  }

  setField(key: string, value: string): void {
    this.fieldValues.update((current) => ({ ...current, [key]: value }));
    this.error.set(null);
  }

  fieldValue(key: string): string {
    return this.fieldValues()[key] ?? '';
  }

  generate(): void {
    const message = this.composedMessage();
    if (!message) return;

    this.loading.set(true);
    this.error.set(null);
    this.resetResult();

    const chatId = this.chatId() ?? undefined;

    if (this.isChecklist()) {
      this.chatHttp
        .generateChecklist({ mode: this.selectedMode() as ChecklistMode, message, chat_id: chatId })
        .subscribe({
          next: (res) => {
            this.loading.set(false);
            this.generatedChecklist.set(res.checklist);
            this.toast.show('Checklist generada y guardada.', 'success');
            this.created.emit();
          },
          error: () => {
            this.loading.set(false);
            this.error.set('No se pudo generar la checklist. Verificá que tengas el permiso LLM_CHECKLIST_GENERATE.');
          },
        });
      return;
    }

    this.chatHttp
      .generateReport({
        type: this.selectedKind() as ReportType,
        mode: this.selectedMode() as ReportMode,
        message,
        chat_id: chatId,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.generatedReport.set(res.report);
          this.toast.show('Informe generado y guardado.', 'success');
          this.created.emit();
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudo generar el informe. Verificá que tengas el permiso LLM_REPORT_GENERATE.');
        },
      });
  }

  exportResult(format: 'pdf' | 'markdown'): void {
    if (this.exporting() !== null) return;
    const report = this.generatedReport();
    const checklist = this.generatedChecklist();
    this.exporting.set(format);

    if (report) {
      const safe = report.title.slice(0, 40).replace(/[^\w-]/g, '_');
      const req$ = format === 'pdf'
        ? this.chatHttp.exportReportPdf(report.id)
        : this.chatHttp.exportReportMarkdown(report.id);
      req$.subscribe({
        next: (blob) => {
          this.exporting.set(null);
          triggerDownload(blob, `${report.type}_${safe}.${format === 'pdf' ? 'pdf' : 'md'}`);
        },
        error: () => {
          this.exporting.set(null);
          this.toast.show('No se pudo exportar el informe.', 'error');
        },
      });
      return;
    }

    if (checklist) {
      const safe = checklist.title.slice(0, 40).replace(/[^\w-]/g, '_');
      const req$ = format === 'pdf'
        ? this.chatHttp.exportChecklistPdf(checklist.id)
        : this.chatHttp.exportChecklistMarkdown(checklist.id);
      req$.subscribe({
        next: (blob) => {
          this.exporting.set(null);
          triggerDownload(blob, `checklist_${safe}.${format === 'pdf' ? 'pdf' : 'md'}`);
        },
        error: () => {
          this.exporting.set(null);
          this.toast.show('No se pudo exportar la checklist.', 'error');
        },
      });
    }
  }

  startNew(): void {
    this.fieldValues.set({});
    this.resetResult();
  }

  private resetResult(): void {
    this.generatedReport.set(null);
    this.generatedChecklist.set(null);
    this.error.set(null);
  }

  autosizeTextarea(el: HTMLTextAreaElement, maxPx = 280): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
  }
}
