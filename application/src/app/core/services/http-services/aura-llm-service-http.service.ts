import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ReportType = 'SITREP' | 'INTSUM' | 'OPORD';
export type ReportMode = 'direct' | 'rag';
export type ChecklistMode = 'direct' | 'rag';

export interface ReportMessage {
  readonly role: 'human' | 'assistant';
  readonly content: string;
}

export interface FragmentDocumentDto {
  readonly id: number;
  readonly name: string;
  readonly type: string | null;
  readonly category: string | null;
}

export interface ReportFragmentDto {
  readonly id: number;
  readonly content: string;
  readonly fragment_index: number;
  readonly summary: string | null;
  readonly document: FragmentDocumentDto;
}

export interface ReportGenerateBody {
  readonly report_type: ReportType;
  readonly mode: ReportMode;
  readonly messages: readonly ReportMessage[];
}

export interface ReportGenerateResponseDto {
  readonly report_type: ReportType;
  readonly content: string;
  readonly messages: readonly ReportMessage[];
  readonly fragments: readonly ReportFragmentDto[];
}

export interface ChecklistItemLlm {
  readonly id: string;
  readonly section: string;
  readonly order: number;
  readonly text: string;
  readonly is_checked: boolean;
  readonly notes: string;
}

export interface ChecklistGenerateBody {
  readonly mode: ChecklistMode;
  readonly messages: readonly ReportMessage[];
}

export interface ChecklistGenerateResponseDto {
  readonly title: string;
  readonly items: readonly ChecklistItemLlm[];
  readonly messages: readonly ReportMessage[];
  readonly fragments: readonly ReportFragmentDto[];
}

@Injectable({ providedIn: 'root' })
export class AuraLlmServiceHttp {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.llmApiUrl}/api/v1`;

  generateReport(body: ReportGenerateBody): Observable<ReportGenerateResponseDto> {
    return this.http.post<ReportGenerateResponseDto>(`${this.base}/report-generate`, body);
  }

  generateChecklist(body: ChecklistGenerateBody): Observable<ChecklistGenerateResponseDto> {
    return this.http.post<ChecklistGenerateResponseDto>(`${this.base}/checklist-generate`, body);
  }
}
