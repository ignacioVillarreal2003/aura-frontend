import {Component, signal, computed, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { SearchChatComponent } from '../../search-chat/pages/search-chat/search-chat.component';
import { EventOptionsMenuComponent } from '../components/event-options-menu/event-options-menu.component';
import { ConfigurationModalComponent } from '../../configurations/components/configuration-modal/configuration-modal.component';

@Component({
  selector: 'app-main-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchChatComponent, EventOptionsMenuComponent, ConfigurationModalComponent],
  templateUrl: './main-container.component.html',
  styleUrls: ['./main-container.component.css'],
})
export class MainContainerComponent {
  private router = inject(Router);
  collapsed = signal(false);
  activeId = signal<string | null>('new-chat');
  showSearchModal = signal(false);
  showProfileMenu = signal(false);
  showConfigModal = signal(false);
  gridCols = computed(() => this.collapsed() ? '72px 1fr' : '280px 1fr');

  onSelect(id: string) {
    this.activeId.set(id);
    if (id === 'profile') {
      this.showProfileMenu.set(true);
    }
    if (id === 'search') {
      this.showSearchModal.set(true);
    }
    if (id === 'main')    this.router.navigate(['/chat', 0]);
  }

  onNewChat() {
    this.activeId.set('new-chat');
    this.router.navigate(['/main-container/new-chat']);
  }

  onCloseSearchModal() {
    this.showSearchModal.set(false);
  }

  onCloseProfileMenu() {
    this.showProfileMenu.set(false);
  }

  onCloseConfigModal() {
    this.showConfigModal.set(false);
  }

  onProfileMenuOption(optionId: string) {
    console.log('Opción seleccionada:', optionId);
    switch(optionId) {
      case 'profile':
        this.router.navigate(['/main-container/user-profile']);
        break;
      case 'notifications':
        this.router.navigate(['/main-container/notifications']);
        break;
      case 'settings':
        this.showConfigModal.set(true);
        break;
      case 'logout':
        console.log('Cerrando sesión...');
        this.router.navigate(['/login']);
        break;
    }
  }

  onChatModeChange(mode: string) {
    console.log('Modo de chat cambiado a:', mode);
  }
}
