import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import { ChatService } from '@core/services/chat/chat.service';
import type { ChatMode } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-home.html',
  styleUrls: ['./chat-home.css'],
})
export class ChatHomeComponent {
  private readonly router = inject(Router);
  private readonly api = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);
  private readonly chatShell = inject(ChatService);

  message = signal('');
  submitting = signal(false);
  readonly modeDropdownOpen = signal(false);
  readonly chatMode = this.chatShell.chatMode;
  readonly pendingFiles = signal<File[]>([]);

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

  toggleModeDropdown(): void {
    this.modeDropdownOpen.update((v) => !v);
  }

  setChatMode(mode: ChatMode): void {
    this.chatShell.setChatMode(mode);
    this.modeDropdownOpen.set(false);
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (this.chatMode() === 'summary' && files.length > 0) {
      this.pendingFiles.update((prev) => [...prev, ...files]);
    }
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

  onSummarizeSend(): void {
    if (this.submitting() || this.pendingFiles().length === 0) return;
    const name = 'Resumen de documentos';
    this.submitting.set(true);
    this.chatShell.setPendingSummaryFiles(this.pendingFiles());
    this.api.createChat({ name }).subscribe({
      next: (chat) => {
        this.submitting.set(false);
        this.pendingFiles.set([]);
        void this.router.navigate(['/main-container', 'chat', String(chat.id)]);
      },
      error: () => {
        this.submitting.set(false);
        this.chatShell.setPendingSummaryFiles([]);
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
