import { Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MarkdownPipe, MarkdownInlinePipe } from '../../../../shared/pipes/markdown.pipe';

export interface TimelineItem {
  id: number;
  year: string;
  title: string;
  description: string;
}

/**
 * Línea de tiempo circular minimalista (inspirada en Apple / Stripe / Linear).
 *
 * - Dial radial grande y desplazado a la izquierda (sale parcialmente de la
 *   pantalla); el evento activo se posiciona al este apuntando al contenido.
 * - Los puntos se unen por el contorno de una circunferencia.
 * - Navegación: hover sobre un punto, scroll vertical con snap, flechas
 *   prev/next y teclado. Sin autoplay.
 * - Transiciones premium (fade + scale + desplazamiento, ~600ms easeInOut).
 */
@Component({
  selector: 'app-circular-timeline',
  standalone: true,
  imports: [DecimalPipe, MarkdownPipe, MarkdownInlinePipe],
  templateUrl: './circular-timeline.html',
  styleUrl: './circular-timeline.css',
})
export class CircularTimeline {
  readonly items = input.required<TimelineItem[]>();

  readonly activeIndex = signal(0);

  readonly active = computed(() => this.items()[this.activeIndex()] ?? null);

  /** Render keyed por id para re-disparar la animación de entrada en cada cambio. */
  readonly activeList = computed(() => {
    const a = this.active();
    return a ? [a] : [];
  });

  private readonly step = computed(() => {
    const n = this.items().length;
    return n > 0 ? 360 / n : 0;
  });

  /** Rotación del dial para llevar el evento activo a la posición de foco (este). */
  readonly dialRotation = computed(() => -this.activeIndex() * this.step());

  readonly dots = computed(() =>
    this.items().map((item, i) => ({ item, baseAngle: i * this.step() })),
  );

  /** Contra-rotación para mantener las etiquetas derechas mientras el dial gira. */
  labelRotation(baseAngle: number): number {
    return -(baseAngle + this.dialRotation());
  }

  setActive(i: number): void {
    const n = this.items().length;
    if (n === 0) return;
    this.activeIndex.set(((i % n) + n) % n);
  }

  next(): void {
    this.setActive(this.activeIndex() + 1);
  }

  prev(): void {
    this.setActive(this.activeIndex() - 1);
  }
}
