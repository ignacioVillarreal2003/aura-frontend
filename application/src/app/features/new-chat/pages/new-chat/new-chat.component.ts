import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../../../core/services/chat.service';

@Component({
  selector: 'app-new-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-chat.component.html',
  styleUrls: ['./new-chat.component.css']
})
export class NewChatComponent {
  private router = inject(Router);
  private chatService = inject(ChatService);

  message = '';
  loading = signal(false);

  send(): void {
    const text = this.message.trim();
    if (!text || this.loading()) return;
    this.loading.set(true);

    const name = text.length > 50 ? text.substring(0, 50).trim() + '...' : text;

    this.chatService.createChat(name).subscribe({
      next: (chat) => {
        this.router.navigate(['/main-container/chat', chat.id], {
          state: { initialMessage: text }
        });
      },
      error: () => this.loading.set(false)
    });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
