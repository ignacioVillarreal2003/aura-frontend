import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuraChatApiService } from '@core/services/aura-chat-api.service';
import { ToastService } from '@core/components/toast-service';

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-home.html',
  styleUrls: ['./chat-home.css'],
})
export class ChatHomeComponent {
  private readonly router = inject(Router);
  private readonly api = inject(AuraChatApiService);
  private readonly toast = inject(ToastService);

  message = signal('');
  submitting = signal(false);

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  onMessageInput(value: string): void {
    this.message.set(value);
    queueMicrotask(() => this.autosizeTextarea());
  }

  private autosizeTextarea(): void {
    const el = this.messageBox()?.nativeElement;
    if (!el) return;

    const styles = getComputedStyle(el);
    const maxHeight = parseFloat(styles.maxHeight);
    const maxPx = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160;

    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const next = Math.min(scrollH, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = scrollH > maxPx ? 'auto' : 'hidden';
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = '';
  }

  onSend(): void {
    const text = this.message().trim();
    if (!text || this.submitting()) return;
    const name = text.slice(0, 80).replace(/\s+/g, ' ').trim() || 'Nuevo chat';
    this.submitting.set(true);
    this.api.createChat({ name }).subscribe({
      next: (chat) => {
        this.submitting.set(false);
        this.message.set('');
        queueMicrotask(() => this.autosizeTextarea());
        void this.router.navigate(['/main-container', 'chat', String(chat.id)], {
          state: { pendingMessage: text },
        });
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show('No se pudo crear el chat.', 'error');
      },
    });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }
}
