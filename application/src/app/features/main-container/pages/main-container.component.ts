import {Component, signal, computed, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { SearchChatComponent } from '../../search-chat/pages/search-chat/search-chat.component';
import { EventOptionsMenuComponent } from '../components/event-options-menu/event-options-menu.component';

@Component({
  selector: 'app-main-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchChatComponent, EventOptionsMenuComponent],
  templateUrl: './main-container.component.html',
  styleUrls: ['./main-container.component.css'],
})
export class MainContainerComponent {
  private router = inject(Router);
  collapsed = signal(false);
  activeId = signal<string | null>('new-chat');
  showSearchModal = signal(false);
  showProfileMenu = signal(false);
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

  onProfileMenuOption(optionId: string) {
    console.log('Opción seleccionada:', optionId);
    switch(optionId) {
      case 'profile':
        // Navegar a perfil de usuario
        this.router.navigate(['/main-container/user-profile']);
        break;
      case 'notifications':
        // Navegar a notificaciones
        this.router.navigate(['/main-container/notifications']);
        break;
      case 'settings':
        // Abrir modal de configuración
        console.log('Abrir modal de configuración');
        break;
      case 'logout':
        // Cerrar sesión
        console.log('Cerrando sesión...');
        this.router.navigate(['/login']);
        break;
    }
  }

  onChatModeChange(mode: string) {
    console.log('Modo de chat cambiado a:', mode);
    // Aquí puedes agregar la lógica para cambiar el comportamiento según el modo
    // Por ejemplo, cambiar la interfaz, los estilos, etc.
  }
}
