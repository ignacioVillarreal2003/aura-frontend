import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ToolGeneratorComponent } from './tool-generator.component';
import type { ReportType } from '@aura-types/aura-chat-service.types';

type GeneratorKind = ReportType | 'CHECKLIST';

@Component({
  selector: 'app-tool-generator-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ToolGeneratorComponent],
  templateUrl: './tool-generator-page.component.html',
  styleUrl: './tool-generator-page.component.css',
})
export class ToolGeneratorPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialKind = signal<GeneratorKind | null>(
    (this.route.snapshot.data['initialKind'] as GeneratorKind | undefined) ?? null,
  );
  readonly pageTitle = signal<string>(
    (this.route.snapshot.data['pageTitle'] as string | undefined) ?? 'Generador',
  );
  readonly pageSubtitle = signal<string>(
    (this.route.snapshot.data['pageSubtitle'] as string | undefined) ?? '',
  );
}
