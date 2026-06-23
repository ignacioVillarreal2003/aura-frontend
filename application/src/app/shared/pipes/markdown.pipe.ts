import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.use({
  breaks: true,
  gfm: true,
});

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const raw = value ?? '';
    if (!raw.trim()) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    const html = marked.parse(raw, { async: false }) as string;
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}

/**
 * Markdown en línea: convierte el formato inline (negrita, itálica, código,
 * enlaces, saltos) SIN envolver en bloques (<p>, <ul>, <h*>).
 *
 * Pensado para títulos y descripciones cortas donde el contenido del LLM
 * suele ser texto plano pero ocasionalmente trae Markdown: así se ve bien
 * sin romper headings ni recortes de línea (line-clamp).
 */
@Pipe({
  name: 'markdownInline',
  standalone: true,
})
export class MarkdownInlinePipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const raw = value ?? '';
    if (!raw.trim()) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    const html = marked.parseInline(raw, { async: false }) as string;
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
