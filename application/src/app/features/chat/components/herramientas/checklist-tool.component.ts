import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AuraLlmServiceHttp,
  type ReportMessage,
  type ChecklistMode,
  type ChecklistItemLlm,
} from '../../../../core/services/http-services/aura-llm-service-http.service';
import { AuraChatServiceHttp } from '../../../../core/services/http-services/aura-chat-service-http.service';

type ChecklistSection = { name: string; items: ChecklistItemLlm[] };

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-checklist-tool',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checklist-tool.component.html',
  styleUrl: './checklist-tool.component.css',
})
export class ChecklistToolComponent {
  private readonly llmHttp = inject(AuraLlmServiceHttp);
  private readonly chatHttp = inject(AuraChatServiceHttp);

  readonly selectedMode = signal<ChecklistMode>('direct');
  readonly userInput = signal('');
  readonly refineInput = signal('');

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly exporting = signal<'pdf' | 'markdown' | null>(null);
  readonly error = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly generatedTitle = signal<string | null>(null);
  readonly generatedItems = signal<ChecklistItemLlm[]>([]);
  readonly savedChecklistId = signal<number | null>(null);

  private conversationHistory = signal<readonly ReportMessage[]>([]);

  readonly hasGenerated = computed(() => this.generatedTitle() !== null);
  readonly canGenerate = computed(() => this.userInput().trim().length > 0 && !this.loading());
  readonly canRefine = computed(() => this.refineInput().trim().length > 0 && !this.loading() && this.hasGenerated());

  readonly totalItems = computed(() => this.generatedItems().length);
  readonly checkedItems = computed(() => this.generatedItems().filter((i) => i.is_checked).length);
  readonly progressPct = computed(() =>
    this.totalItems() === 0 ? 0 : Math.round((this.checkedItems() / this.totalItems()) * 100)
  );

  readonly groupedSections = computed<ChecklistSection[]>(() => {
    const items = this.generatedItems();
    const map = new Map<string, ChecklistItemLlm[]>();
    for (const item of items) {
      const sec = item.section || 'General';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(item);
    }
    const sections: ChecklistSection[] = [];
    for (const [name, secItems] of map) {
      sections.push({ name, items: [...secItems].sort((a, b) => a.order - b.order) });
    }
    return sections;
  });

  selectMode(mode: ChecklistMode): void {
    this.selectedMode.set(mode);
  }

  onInputChange(value: string): void {
    this.userInput.set(value);
  }

  onRefineChange(value: string): void {
    this.refineInput.set(value);
  }

  toggleItem(itemId: string): void {
    this.generatedItems.update((items) =>
      items.map((item) =>
        item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
      )
    );
    this.saveSuccess.set(false);
    this.savedChecklistId.set(null);
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
    this.savedChecklistId.set(null);

    this.llmHttp
      .generateChecklist({
        mode: this.selectedMode(),
        messages,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.generatedTitle.set(res.title);
          this.generatedItems.set([...res.items]);
          this.conversationHistory.set(res.messages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            'No se pudo generar la checklist. Verificá que el LLM service esté activo y que tengas el permiso LLM_CHECKLIST_GENERATE.'
          );
        },
      });
  }

  saveChecklist(): void {
    const title = this.generatedTitle();
    const items = this.generatedItems();
    if (!title || !items.length) return;

    this.saving.set(true);
    this.saveSuccess.set(false);

    const existingId = this.savedChecklistId();

    if (existingId) {
      this.chatHttp
        .patchChecklist(existingId, { items })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.saveSuccess.set(true);
          },
          error: () => {
            this.saving.set(false);
            this.error.set('No se pudo actualizar la checklist.');
          },
        });
    } else {
      this.chatHttp
        .createChecklist({
          title,
          items,
          mode: this.selectedMode(),
          metadata: {},
        })
        .subscribe({
          next: (cl) => {
            this.saving.set(false);
            this.saveSuccess.set(true);
            this.savedChecklistId.set(cl.id);
          },
          error: () => {
            this.saving.set(false);
            this.error.set('No se pudo guardar la checklist.');
          },
        });
    }
  }

  exportPdf(): void {
    const checklistId = this.savedChecklistId();
    if (!checklistId) {
      this.error.set('Guardá la checklist primero para exportar como PDF.');
      return;
    }
    this.exporting.set('pdf');
    this.chatHttp.exportChecklistPdf(checklistId).subscribe({
      next: (blob) => {
        this.exporting.set(null);
        const title = (this.generatedTitle() ?? 'checklist').slice(0, 40).replace(/\s+/g, '_');
        triggerDownload(blob, `checklist_${title}.pdf`);
      },
      error: () => {
        this.exporting.set(null);
        this.error.set('Error al exportar el PDF.');
      },
    });
  }

  exportMarkdown(): void {
    const checklistId = this.savedChecklistId();
    const title = this.generatedTitle() ?? 'checklist';

    if (checklistId) {
      this.exporting.set('markdown');
      this.chatHttp.exportChecklistMarkdown(checklistId).subscribe({
        next: (blob) => {
          this.exporting.set(null);
          triggerDownload(blob, `checklist_${title.slice(0, 40).replace(/\s+/g, '_')}.md`);
        },
        error: () => {
          this.exporting.set(null);
          this.error.set('Error al exportar Markdown.');
        },
      });
    } else {
      const lines = this._buildMarkdownLocal(title);
      const blob = new Blob([lines], { type: 'text/markdown; charset=utf-8' });
      triggerDownload(blob, `checklist_${title.slice(0, 40).replace(/\s+/g, '_')}.md`);
    }
  }

  private _buildMarkdownLocal(title: string): string {
    const items = this.generatedItems();
    const total = items.length;
    const checked = items.filter((i) => i.is_checked).length;

    const sections = this.groupedSections();
    const lines: string[] = [
      '# CHECKLIST DE PROCEDIMIENTO',
      '',
      `**${title}**`,
      '',
      `*Progreso: ${checked}/${total} ítems verificados*`,
      '',
      '---',
      '',
    ];
    for (const sec of sections) {
      lines.push(`## ${sec.name}`, '');
      for (const item of sec.items) {
        lines.push(`- ${item.is_checked ? '[x]' : '[ ]'} ${item.text}`);
        if (item.notes) lines.push(`  > ${item.notes}`);
      }
      lines.push('');
    }
    lines.push('---', '*Checklist exportada desde AURA*');
    return lines.join('\n');
  }

  reset(): void {
    this.userInput.set('');
    this.refineInput.set('');
    this.generatedTitle.set(null);
    this.generatedItems.set([]);
    this.conversationHistory.set([]);
    this.error.set(null);
    this.saveSuccess.set(false);
    this.savedChecklistId.set(null);
  }

  autosizeTextarea(el: HTMLTextAreaElement, maxPx = 400): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
  }
}
