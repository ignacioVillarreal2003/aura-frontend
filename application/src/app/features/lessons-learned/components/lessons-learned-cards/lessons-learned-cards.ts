import { Component, computed, input, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { MarkdownPipe, MarkdownInlinePipe } from '../../../../shared/pipes/markdown.pipe';
import type {
  LessonsLearnedItemDto,
  LessonsLearnedCategory,
} from '@aura-types/aura-chat-service.types';

/**
 * Carrusel de lecciones aprendidas: una card minimalista por ítem, centrada,
 * con toda su información (categoría, observación, discusión y recomendación).
 *
 * - Paleta exclusivamente violeta, independiente de la categoría.
 * - Navegación con dos flechas a los costados (prev/next, cíclico).
 * - La card se renderiza keyed por id para re-disparar la animación de entrada
 *   en cada cambio (fade + scale + desplazamiento).
 */
@Component({
  selector: 'app-lessons-learned-cards',
  standalone: true,
  imports: [NgClass, DecimalPipe, MarkdownPipe, MarkdownInlinePipe],
  templateUrl: './lessons-learned-cards.html',
  styleUrl: './lessons-learned-cards.css',
})
export class LessonsLearnedCards {
  readonly items = input.required<readonly LessonsLearnedItemDto[]>();

  readonly activeIndex = signal(0);

  private readonly meta: Record<LessonsLearnedCategory, { label: string; icon: string }> = {
    sustain: { label: 'Sostener', icon: 'pi-check-circle' },
    improve: { label: 'Mejorar', icon: 'pi-arrow-up-right' },
    recommendation: { label: 'Recomendación', icon: 'pi-star' },
  };

  /** Índice acotado al rango actual de ítems (cíclico y seguro ante cambios). */
  private readonly safeIndex = computed(() => {
    const n = this.items().length;
    if (n === 0) return 0;
    const i = this.activeIndex();
    return ((i % n) + n) % n;
  });

  readonly active = computed(() => this.items()[this.safeIndex()] ?? null);

  /** Render keyed por id → re-dispara la animación de entrada en cada cambio. */
  readonly activeList = computed(() => {
    const a = this.active();
    return a ? [a] : [];
  });

  readonly displayIndex = computed(() => this.safeIndex());

  setActive(i: number): void {
    const n = this.items().length;
    if (n === 0) return;
    this.activeIndex.set(((i % n) + n) % n);
  }

  next(): void {
    this.setActive(this.safeIndex() + 1);
  }

  prev(): void {
    this.setActive(this.safeIndex() - 1);
  }

  categoryLabel(cat: LessonsLearnedCategory): string {
    return this.meta[cat]?.label ?? cat;
  }

  categoryIcon(cat: LessonsLearnedCategory): string {
    return this.meta[cat]?.icon ?? 'pi-circle';
  }
}
