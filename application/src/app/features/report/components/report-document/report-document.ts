import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import type { ReportDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-report-document',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './report-document.html',
  styleUrl: './report-document.css',
})
export class ReportDocument {
  @Input({ required: true }) report!: ReportDto;
}
