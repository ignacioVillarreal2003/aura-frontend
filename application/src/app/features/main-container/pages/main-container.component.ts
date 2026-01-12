import {Component, signal, computed, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { SearchChatComponent } from '../../search-chat/pages/search-chat/search-chat.component';
import { EventOptionsMenuComponent } from '../components/event-options-menu/event-options-menu.component';
import { ConfigurationModalComponent } from '../components/configuration-modal/configuration-modal.component';
import { LogoutConfirmationModalComponent } from '../components/logout-confirmation-modal/logout-confirmation-modal.component';
import { GroupChatLinkModalComponent } from '../components/group-chat-link-modal/group-chat-link-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { GroupChatService, GroupChat } from '../../../core/services/group-chat.service';
import { ChatService } from '../../../core/services/chat.service';

@Component({
  selector: 'app-main-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchChatComponent, EventOptionsMenuComponent, ConfigurationModalComponent, LogoutConfirmationModalComponent, GroupChatLinkModalComponent],
  templateUrl: './main-container.component.html',
  styleUrls: ['./main-container.component.css'],
})
export class MainContainerComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private groupChatService = inject(GroupChatService);
  private chatService = inject(ChatService);
  
  collapsed = signal(false);
  activeId = signal<string | null>('new-chat');
  showSearchModal = signal(false);
  showProfileMenu = signal(false);
  showConfigModal = signal(false);
  showLogoutModal = signal(false);
  showGroupLinkModal = signal(false);
  currentGroupChat = signal<GroupChat | null>(null);
  groupShareLink = signal<string>('');
  gridCols = computed(() => this.collapsed() ? '72px 1fr' : '280px 1fr');

  onSelect(id: string) {
    this.activeId.set(id);
    if (id === 'profile') {
      this.showProfileMenu.set(true);
    }
    if (id === 'search') {
      this.showSearchModal.set(true);
    }
  }

  onChatSelect(data: {id: string, isGroup: boolean}) {
    this.activeId.set(data.id);
    if (data.isGroup) {
      this.router.navigate(['/main-container/group-chat', data.id]);
    } else {
      this.router.navigate(['/main-container/chat', data.id]);
    }
  }

  onNewChat() {
    this.activeId.set('new-chat');
    this.router.navigate(['/main-container/new-chat']);
  }

  onNewGroupChat() {
    const userEmail = 'usuario@ejemplo.com'; // TODO: Obtener del AuthService
    const userName = 'Usuario Ejemplo'; // TODO: Obtener del AuthService
    
    const groupChat = this.groupChatService.createGroupChat(userEmail, userName);
    this.currentGroupChat.set(groupChat);
    this.groupShareLink.set(this.groupChatService.getShareLink(groupChat));
    this.showGroupLinkModal.set(true);
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
        this.showLogoutModal.set(true);
        break;
    }
  }

  onCloseGroupLinkModal() {
    this.showGroupLinkModal.set(false);
    
    // Navegar al chat grupal recién creado
    if (this.currentGroupChat()) {
      this.router.navigate(['/main-container/group-chat', this.currentGroupChat()!.id]);
    }
  }

  onCloseLogoutModal() {
    this.showLogoutModal.set(false);
  }

  onConfirmLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.showLogoutModal.set(false);
  }

  onChatAction(data: {chatId: string, action: string}) {
    console.log('Acción de chat:', data);
    
    switch (data.action) {
      case 'share':
        console.log('Compartir chat:', data.chatId);
        // Si es un chat grupal, mostrar el enlace
        const groupChat = this.groupChatService.getGroupChatById(data.chatId);
        if (groupChat) {
          this.currentGroupChat.set(groupChat);
          this.groupShareLink.set(this.groupChatService.getShareLink(groupChat));
          this.showGroupLinkModal.set(true);
        }
        break;
      case 'rename':
        console.log('Renombrar chat:', data.chatId);
        // TODO: Implementar renombrar chat
        break;
      case 'archive':
        console.log('Archivar chat:', data.chatId);
        // TODO: Implementar archivar chat
        break;
      case 'delete':
        console.log('Eliminar chat:', data.chatId);
        const chatToDelete = this.groupChatService.getGroupChatById(data.chatId);
        if (chatToDelete) {
          this.groupChatService.deleteGroupChat(data.chatId);
        }
        break;
    }
  }
}
