import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { FeedbackReason } from '../../../../core/types/aura-chat-service.types';

export interface DislikeFeedbackResult {
  readonly reason: FeedbackReason | null;
  readonly comment: string | null;
}

const REASON_OPTIONS: readonly { value: FeedbackReason; label: string; icon: string }[] = [
  { value: 'incorrect',    label: 'Información incorrecta',        icon: 'pi-exclamation-circle' },
  { value: 'incomplete',   label: 'Respuesta incompleta',          icon: 'pi-minus-circle'       },
  { value: 'off_topic',    label: 'No responde lo que pregunté',   icon: 'pi-compass'            },
  { value: 'tone',         label: 'Tono o estilo inadecuado',      icon: 'pi-volume-off'         },
  { value: 'too_long',     label: 'Demasiado larga o verbosa',     icon: 'pi-list'               },
  { value: 'hallucination',label: 'Inventó datos',                 icon: 'pi-eye-slash'          },
  { value: 'other',        label: 'Otro',                          icon: 'pi-ellipsis-h'         },
];

const COMMENT_MAX = 500;

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.css',
})
export class FeedbackDialog {
  readonly submitFeedback = output<DislikeFeedbackResult>();
  readonly cancel = output<void>();

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
