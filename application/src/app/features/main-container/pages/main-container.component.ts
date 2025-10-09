import {Component, signal, computed, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';

@Component({
  selector: 'app-main-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './main-container.component.html',
  styleUrls: ['./main-container.component.css'],
})
export class MainContainerComponent {
  private router = inject(Router);
  collapsed = signal(false);
  activeId = signal<string | null>('new-chat');
  gridCols = computed(() => this.collapsed() ? '72px 1fr' : '280px 1fr');

  onSelect(id: string) {
    this.activeId.set(id);
    if (id === 'profile') this.router.navigate(['/perfil']);
    if (id === 'search')  this.router.navigate(['/buscar']);
    if (id === 'main')    this.router.navigate(['/chat', 0]);
  }

  onNewChat() {
    this.activeId.set('new-chat');
    this.router.navigate(['/main-container/new-chat']);
  }
}
