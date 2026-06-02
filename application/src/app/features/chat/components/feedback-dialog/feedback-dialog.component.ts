import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../../shared/components/modals/modal/modal';
import type { FeedbackReason } from '../../../../core/types/aura-chat-service.types';

export interface DislikeFeedbackResult {
  readonly reason: FeedbackReason | null;
  readonly comment: string | null;
}

const REASON_OPTIONS: readonly { value: FeedbackReason; label: string }[] = [
  { value: 'incorrect', label: 'Información incorrecta' },
  { value: 'incomplete', label: 'Respuesta incompleta' },
  { value: 'off_topic', label: 'No responde lo que pregunté' },
  { value: 'tone', label: 'Tono o estilo inadecuado' },
  { value: 'too_long', label: 'Demasiado larga o verbosa' },
  { value: 'hallucination', label: 'Inventó datos' },
  { value: 'other', label: 'Otro' },
];

const COMMENT_MAX = 500;

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.css',
})
export class FeedbackDialogComponent {
  @Output() readonly submitFeedback = new EventEmitter<DislikeFeedbackResult>();
  @Output() readonly cancel = new EventEmitter<void>();

  readonly reasons = REASON_OPTIONS;
  readonly commentMax = COMMENT_MAX;
  readonly selectedReason = signal<FeedbackReason | null>(null);
  readonly comment = signal('');

  toggleReason(value: FeedbackReason): void {
    this.selectedReason.update((current) => (current === value ? null : value));
  }

  onCommentInput(value: string): void {
    this.comment.set(value.slice(0, COMMENT_MAX));
  }

  submit(): void {
    const trimmed = this.comment().trim();
    this.submitFeedback.emit({
      reason: this.selectedReason(),
      comment: trimmed.length > 0 ? trimmed : null,
    });
  }

  onClose(): void {
    this.cancel.emit();
  }
}
