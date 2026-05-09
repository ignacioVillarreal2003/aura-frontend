import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-herramienta-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './herramienta-placeholder.component.html',
  styleUrl: './herramienta-placeholder.component.css',
})
export class HerramientaPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly meta$ = this.route.data.pipe(
    map((d) => ({
      title: (d['toolTitle'] as string) ?? 'Herramienta',
      description: (d['toolDescription'] as string) ?? '',
    }))
  );
}
