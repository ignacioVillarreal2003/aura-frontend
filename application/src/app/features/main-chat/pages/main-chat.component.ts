import {Component, signal, computed, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';

@Component({
  selector: 'app-main-chat',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './main-chat.component.html',
  styleUrls: ['./main-chat.component.css'],
})
export class MainChatComponent {
  private router = inject(Router);
  collapsed = signal(false);
  activeId = signal<string | null>('inbox');
  gridCols = computed(() => this.collapsed() ? '72px 1fr' : '280px 1fr');

  onSelect(id: string) {
    this.activeId.set(id);
    if (id === 'profile') this.router.navigate(['/perfil']);
    if (id === 'search')  this.router.navigate(['/buscar']);
    if (id === 'main')    this.router.navigate(['/chat', 0]);
  }

  onNewChat() {
    this.router.navigate(['/chat', 'new']);
  }
}
