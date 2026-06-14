import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  input,
} from '@angular/core';

/**
 * Observes innerHTML updates on a markdown-rendered element during AI streaming.
 * Each RAF-batched update produces a set of new text nodes; this directive wraps
 * those nodes in <span class="t-new"> so CSS can animate them (blur→sharp, fade-in).
 * The spans are ephemeral — the next innerHTML replacement clears them automatically.
 *
 * Usage:
 *   <div [innerHTML]="msg | markdown" [tokenMaterialize]="isStreaming"></div>
 */
@Directive({
  selector: '[tokenMaterialize]',
  standalone: true,
})
export class TokenMaterializeDirective implements OnDestroy {
  readonly active = input(false, { alias: 'tokenMaterialize' });

  private readonly el: HTMLElement;
  private observer: MutationObserver | null = null;
  private prevLen = 0;
  private busy = false;

  constructor(elRef: ElementRef<HTMLElement>) {
    this.el = elRef.nativeElement;

    // React to `active` toggling: signal inputs don't fire ngOnChanges, so an
    // effect plays the role of the previous ngOnInit + ngOnChanges logic.
    effect(() => {
      this.prevLen = 0;
      if (this.active()) {
        this._attach();
      } else {
        this._detach();
      }
    });
  }

  ngOnDestroy(): void {
    this._detach();
  }

  private _attach(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => {
      if (this.busy) return;
      this._onMutation();
    });
    this.observer.observe(this.el, { childList: true, subtree: true });
  }

  private _detach(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private _onMutation(): void {
    const currentLen = (this.el.textContent ?? '').length;
    if (currentLen <= this.prevLen) {
      this.prevLen = currentLen;
      return;
    }

    const newStart = this.prevLen;
    this.prevLen = currentLen;

    // Pause observation while we modify the DOM to prevent recursion
    this.busy = true;
    this.observer?.disconnect();
    try {
      this._annotateNewContent(newStart);
    } finally {
      this.busy = false;
      if (this.active()) {
        this.observer ??= new MutationObserver(() => {
          if (this.busy) return;
          this._onMutation();
        });
        this.observer.observe(this.el, { childList: true, subtree: true });
      }
    }
  }

  /**
   * Walks all text nodes in the element. Nodes whose character range falls
   * entirely after `newStart` are wrapped in an animated span. Nodes that
   * straddle the boundary are split: the old portion stays as a plain text
   * node, the new portion gets the animated span.
   */
  private _annotateNewContent(newStart: number): void {
    let accumulated = 0;
    let tokenIdx = 0;

    // Collect first (TreeWalker invalidates if we modify mid-walk)
    const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
    const entries: Array<{ node: Text; splitAt: number | null }> = [];

    let textNode = walker.nextNode() as Text | null;
    while (textNode) {
      const len = textNode.length;
      const end = accumulated + len;

      if (end > newStart) {
        const splitAt = newStart > accumulated ? newStart - accumulated : null;
        entries.push({ node: textNode, splitAt });
      }

      accumulated += len;
      textNode = walker.nextNode() as Text | null;
    }

    for (const { node, splitAt } of entries) {
      const parent = node.parentNode;
      if (!parent) continue;

      if (splitAt !== null && splitAt > 0) {
        const oldText = node.textContent!.slice(0, splitAt);
        const newText = node.textContent!.slice(splitAt);
        if (!newText) continue;

        const oldNode = document.createTextNode(oldText);
        const span = this._makeSpan(tokenIdx++, newText);
        parent.insertBefore(oldNode, node);
        parent.insertBefore(span, node);
        parent.removeChild(node);
      } else {
        if (!node.textContent) continue;
        const span = this._makeSpan(tokenIdx++, null);
        parent.insertBefore(span, node);
        span.appendChild(node);
      }
    }
  }

  private _makeSpan(idx: number, text: string | null): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 't-new';
    span.style.setProperty('--ti', String(idx));
    if (text !== null) span.textContent = text;
    return span;
  }
}
