import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-chat.component.html',
  styleUrls: ['./search-chat.component.css']
})
export class SearchChatComponent {
  @Output() close = new EventEmitter<void>();
  
  searchQuery = '';
  
  // Datos de ejemplo de chats
  chats = {
    hoy: [
      { id: '1', title: 'Explicar inflamación aguda' },
      { id: '2', title: 'Resumen neumonía' }
    ],
    ayer: [
      { id: '3', title: 'Cómo correr proyecto' },
      { id: '4', title: 'Lee el documento resumen' }
    ],
    semana: [
      { id: '5', title: 'Qué es la programación funcional' },
      { id: '6', title: 'Explicar conceptos de Angular' },
      { id: '7', title: 'Diferencia entre TypeScript y JavaScript' }
    ]
  };

  constructor(private router: Router) {}

  onClose() {
    this.close.emit();
  }

  onNewChat() {
    this.router.navigate(['/main-container/new-chat']);
    this.onClose();
  }

  onChatSelect(chatId: string) {
    // Aquí podrías navegar al chat específico
    console.log('Chat seleccionado:', chatId);
    this.onClose();
  }
}
