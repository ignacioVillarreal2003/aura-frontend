import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Respuesta esperada del endpoint de resumen extenso.
 * Ajustá el tipo cuando el backend defina el contrato definitivo.
 */
export type ExtensiveSummaryResponse = {
  summary?: string;
  text?: string;
  result?: string;
};

@Injectable({ providedIn: 'root' })
export class ToolsHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.toolsApiUrl.replace(/\/$/, '');

  /**
   * POST multipart con el archivo. Campo del archivo: `document` (cambiar si el API usa otro nombre).
   */
  extensiveSummary(file: File, options?: { locale?: string }): Observable<string> {
    const data = new FormData();
    data.append('document', file, file.name);
    if (options?.locale) {
      data.append('locale', options.locale);
    }
    return this.http.post<ExtensiveSummaryResponse | string>(`${this.base}/api/tools/extensive-summary`, data).pipe(
      map((body) => {
        if (typeof body === 'string') return body;
        return body.summary ?? body.text ?? body.result ?? JSON.stringify(body, null, 2);
      })
    );
  }
}
