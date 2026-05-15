import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-resumen-extenso-tool',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './resumen-extenso-tool.component.html',
  styleUrl: './resumen-extenso-tool.component.css',
})
export class ResumenExtensoToolComponent {
  private readonly http = inject(HttpClient);

  private extensiveSummary(file: File): Observable<string> {
    const form = new FormData();
    form.append('document', file, file.name);
    const url = `${environment.toolsApiUrl.replace(/\/$/, '')}/api/tools/extensive-summary`;
    return this.http
      .post<{ summary?: string; result?: string } | string>(url, form)
      .pipe(
        map((res) => {
          if (typeof res === 'string') return res;
          return res.summary ?? res.result ?? '';
        }),
      );
  }

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);

  private dragDepth = 0;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.runSummary(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth++;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.runSummary(file);
    }
  }

  triggerPick(input: HTMLInputElement): void {
    input.click();
  }

  clearResult(): void {
    this.result.set(null);
    this.error.set(null);
    this.fileName.set(null);
  }

  private runSummary(file: File): void {
    this.error.set(null);
    this.result.set(null);
    this.fileName.set(file.name);
    this.loading.set(true);
    this.extensiveSummary(file).subscribe({
      next: (text) => {
        this.loading.set(false);
        this.result.set(text || '(Sin contenido en la respuesta)');
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'No se pudo generar el resumen. Comprobá que el backend exponga POST ' +
            '`/api/tools/extensive-summary` en `toolsApiUrl` (environment) y que el campo del archivo sea `document`.'
        );
      },
    });
  }
}
