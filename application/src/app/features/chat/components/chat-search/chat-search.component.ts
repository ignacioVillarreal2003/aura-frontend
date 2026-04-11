import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-search.component.html',
  styleUrls: ['./chat-search.component.css'],
})
export class ChatSearchComponent {
  searchQuery = '';

  chats = {
    hoy: [
      { id: '1', title: 'Explicar inflamación aguda' },
      { id: '2', title: 'Resumen neumonía' },
    ],
    ayer: [
      { id: '3', title: 'Cómo correr proyecto' },
      { id: '4', title: 'Lee el documento resumen' },
    ],
    semana: [
      { id: '5', title: 'Qué es la programación funcional' },
      { id: '6', title: 'Explicar conceptos de Angular' },
      { id: '7', title: 'Diferencia entre TypeScript y JavaScript' },
    ],
  };

  constructor(private router: Router) {}

  @HostListener('document:keydown.escape')
  onEscape() {
    this.goBack();
  }

  goBack(): void {
    void this.router.navigate(['/main-container/new-chat']);
  }

  onNewChat(): void {
    void this.router.navigate(['/main-container/new-chat']);
  }

  onChatSelect(chatId: string): void {
    void this.router.navigate(['/main-container/chat', chatId]);
  }
}
