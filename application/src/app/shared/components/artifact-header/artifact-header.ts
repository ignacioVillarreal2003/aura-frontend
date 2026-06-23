import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { MarkdownInlinePipe } from '../../pipes/markdown.pipe';

export type ArtifactExportFormat = 'pdf' | 'markdown';

/**
 * Cabecera compartida por todos los visores de artefactos
 * (checklist, quiz, timeline, lessons-learned, decision-brief,
 * document-summary, document-action).
 *
 * Línea 1: título + botón "Volver" a la derecha (estilo documentos).
 * Línea 2: descripción + botones de exportación morados.
 */
@Component({
  selector: 'app-artifact-header',
  standalone: true,
  imports: [NgClass, MarkdownInlinePipe],
  templateUrl: './artifact-header.html',
  styleUrl: './artifact-header.css',
})
export class ArtifactHeader {
  /** Título principal del artefacto. */
  readonly title = input.required<string>();

  /** Descripción opcional mostrada debajo del título. */
  readonly description = input<string | null | undefined>(null);

  /** Formato que se está exportando actualmente (deshabilita los botones). */
  readonly exporting = input<ArtifactExportFormat | null>(null);

  /** Se emite al pulsar "Volver". */
  readonly back = output<void>();

  /** Se emite con el formato solicitado al pulsar un botón de exportar. */
  readonly exportRequested = output<ArtifactExportFormat>();
}
