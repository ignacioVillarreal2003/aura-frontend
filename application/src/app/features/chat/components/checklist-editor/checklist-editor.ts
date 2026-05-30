import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  CdkDragHandle,
  CdkDragPlaceholder,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { ChecklistDto, ChecklistSectionDto } from '@aura-types/aura-chat-service.types';

interface EditItem {
  id: string;
  text: string;
  is_checked: boolean;
  notes: string;
}

interface SectionGroup {
  id: string;
  name: string;
  items: EditItem[];
}

@Component({
  selector: 'app-checklist-editor',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDropList, CdkDragHandle, CdkDragPlaceholder, CdkScrollable],
  templateUrl: './checklist-editor.html',
  styleUrl: './checklist-editor.css',
})
export class ChecklistEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly checklist = signal<ChecklistDto | null>(null);
  readonly loading = signal(true);
  readonly editTitle = signal('');
  readonly saving = signal(false);
  readonly exportingAs = signal<'pdf' | 'markdown' | null>(null);

  // Mutable sections array — CDK mutates items arrays in place
  sections = signal<SectionGroup[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly checkedCount = computed(() =>
    this.sections().reduce((acc, s) => acc + s.items.filter((i) => i.is_checked).length, 0),
  );
  readonly totalCount = computed(() =>
    this.sections().reduce((acc, s) => acc + s.items.length, 0),
  );
  readonly progressPct = computed(() => {
    const t = this.totalCount();
    return t === 0 ? 0 : Math.round((this.checkedCount() / t) * 100);
  });

  readonly hasChanges = computed(() => {
    const c = this.checklist();
    if (!c) return false;
    if (this.editTitle().trim() !== c.title) return true;
    const curr = this.sections();
    const orig = [...c.sections].sort((a, b) => a.position - b.position);
    if (curr.length !== orig.length) return true;
    for (let si = 0; si < curr.length; si++) {
      if (curr[si].name !== orig[si].title) return true;
      const origItems = [...orig[si].items].sort((a, b) => a.position - b.position);
      if (curr[si].items.length !== origItems.length) return true;
      for (let ii = 0; ii < curr[si].items.length; ii++) {
        const ci = curr[si].items[ii];
        const oi = origItems[ii];
        if (ci.text !== oi.text || ci.is_checked !== oi.is_checked || ci.notes !== oi.notes) return true;
      }
    }
    return false;
  });

  // ── IDs for cdkDropListConnectedTo ────────────────────────────────────────
  readonly sectionListIds = computed(() => this.sections().map((s) => 'items-' + s.id));

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { void this.router.navigate(['/main-container', 'chat-home']); return; }
    this.http.getChecklist(id).pipe(take(1)).subscribe({
      next: (c) => {
        this.checklist.set(c);
        this.editTitle.set(c.title);
        this.sections.set(this._buildSections(c.sections));
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudo cargar la checklist.', 'error');
        void this.router.navigate(['/main-container', 'chat-home']);
      },
    });
  }

  private _buildSections(sections: readonly ChecklistSectionDto[]): SectionGroup[] {
    return [...sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        name: s.title,
        items: [...s.items]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ id: item.id, text: item.text, is_checked: item.is_checked, notes: item.notes })),
      }));
  }

  goBack(): void {
    const chatId = this.checklist()?.source_chat_id;
    void this.router.navigate(chatId ? ['/main-container', 'chat', chatId] : ['/main-container', 'chat-home']);
  }

  // ── Section DnD ───────────────────────────────────────────────────────────
  dropSection(event: CdkDragDrop<SectionGroup[]>): void {
    const arr = [...this.sections()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.sections.set(arr);
  }

  // ── Item DnD (cross-list) ─────────────────────────────────────────────────
  dropItem(event: CdkDragDrop<EditItem[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    // Trigger signal update (CDK mutates arrays in place, signal needs notify)
    this.sections.update((s) => [...s]);
  }

  // ── Item mutations ────────────────────────────────────────────────────────
  toggleItem(sectionIdx: number, itemIdx: number): void {
    this.sections.update((sections) => {
      const arr = [...sections];
      const items = [...arr[sectionIdx].items];
      items[itemIdx] = { ...items[itemIdx], is_checked: !items[itemIdx].is_checked };
      arr[sectionIdx] = { ...arr[sectionIdx], items };
      return arr;
    });
  }

  updateItemText(sectionIdx: number, itemIdx: number, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.sections.update((sections) => {
      const arr = [...sections];
      const items = [...arr[sectionIdx].items];
      items[itemIdx] = { ...items[itemIdx], text };
      arr[sectionIdx] = { ...arr[sectionIdx], items };
      return arr;
    });
  }

  updateItemNotes(sectionIdx: number, itemIdx: number, event: Event): void {
    const notes = (event.target as HTMLInputElement).value;
    this.sections.update((sections) => {
      const arr = [...sections];
      const items = [...arr[sectionIdx].items];
      items[itemIdx] = { ...items[itemIdx], notes };
      arr[sectionIdx] = { ...arr[sectionIdx], items };
      return arr;
    });
  }

  deleteItem(sectionIdx: number, itemIdx: number): void {
    this.sections.update((sections) => {
      const arr = [...sections];
      const items = arr[sectionIdx].items.filter((_, i) => i !== itemIdx);
      arr[sectionIdx] = { ...arr[sectionIdx], items };
      return arr;
    });
  }

  addItemToSection(sectionIdx: number): void {
    const newId = crypto.randomUUID();
    const newItem: EditItem = { id: newId, text: '', is_checked: false, notes: '' };
    this.sections.update((sections) => {
      const arr = [...sections];
      arr[sectionIdx] = { ...arr[sectionIdx], items: [...arr[sectionIdx].items, newItem] };
      return arr;
    });
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-item-id="${newId}"]`)?.focus(), 0);
  }

  // ── Section mutations ─────────────────────────────────────────────────────
  renameSection(sectionIdx: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.sections.update((sections) => {
      const arr = [...sections];
      arr[sectionIdx] = { ...arr[sectionIdx], name };
      return arr;
    });
  }

  addSection(): void {
    const existing = new Set(this.sections().map((s) => s.name));
    let n = this.sections().length + 1;
    let name = `Sección ${n}`;
    while (existing.has(name)) name = `Sección ${++n}`;
    const newSection: SectionGroup = { id: crypto.randomUUID(), name, items: [] };
    this.sections.update((s) => [...s, newSection]);
    // Auto-add first item to the new section
    setTimeout(() => this.addItemToSection(this.sections().length - 1), 0);
  }

  deleteSection(sectionIdx: number): void {
    const section = this.sections()[sectionIdx];
    if (section.items.length > 0 &&
        !window.confirm(`¿Eliminar "${section.name || 'Sin sección'}" y sus ${section.items.length} ítem(s)?`)) return;
    this.sections.update((s) => s.filter((_, i) => i !== sectionIdx));
  }

  // ── Save / Export ─────────────────────────────────────────────────────────
  save(): void {
    const c = this.checklist();
    if (!c) return;
    const title = this.editTitle().trim();
    if (!title) { this.toast.show('El título no puede estar vacío.', 'error'); return; }
    const sections = this.sections().map((s, si) => ({
      title: s.name,
      position: si + 1,
      items: s.items.map((item, ii) => ({
        text: item.text,
        is_checked: item.is_checked,
        notes: item.notes,
        position: ii + 1,
      })),
    }));
    this.saving.set(true);
    this.http.patchChecklist(c.id, { title, sections }).pipe(take(1)).subscribe({
      next: (updated) => {
        this.checklist.set(updated);
        this.editTitle.set(updated.title);
        this.sections.set(this._buildSections(updated.sections));
        this.saving.set(false);
        this.toast.show('Checklist guardada.', 'success');
      },
      error: () => { this.saving.set(false); this.toast.show('No se pudo guardar.', 'error'); },
    });
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
