import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupChatService, GroupChat } from '../../../../core/services/group-chat.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BtnText } from '../../../../shared/components/buttons/btn-text/btn-text';

@Component({
  selector: 'app-join-group-chat',
  standalone: true,
  imports: [CommonModule, BtnText],
  templateUrl: './join-group-chat.component.html',
  styleUrls: ['./join-group-chat.component.css']
})
export class JoinGroupChatComponent implements OnInit {
  linkId: string = '';
  groupChat: GroupChat | null = null;
  loading = true;
  error: string | null = null;
  joining = false;
  alreadyMember = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupChatService: GroupChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Obtener el linkId de la URL
    this.linkId = this.route.snapshot.paramMap.get('linkId') || '';
    
    if (!this.linkId) {
      this.error = 'Enlace inválido';
      this.loading = false;
      return;
    }

    // Buscar el chat grupal
    this.groupChat = this.groupChatService.getGroupChatByLinkId(this.linkId);
    
    if (!this.groupChat) {
      this.error = 'Chat grupal no encontrado';
      this.loading = false;
      return;
    }

    // Verificar si el usuario ya es miembro
    const userEmail = this.getUserEmail();
    if (this.groupChat.members.includes(userEmail)) {
      this.alreadyMember = true;
    }

    this.loading = false;
  }

  joinChat(): void {
    if (!this.groupChat || this.joining) return;

    this.joining = true;
    const userEmail = this.getUserEmail();
    const userName = this.getUserName();

    const result = this.groupChatService.joinGroupChat(this.linkId, userEmail, userName);

    if (result) {
      // Redirigir al chat grupal
      this.groupChatService.setCurrentGroupChat(result);
      this.router.navigate(['/main-container/group-chat', result.id]);
    } else {
      this.error = 'No se pudo unir al chat grupal';
      this.joining = false;
    }
  }

  goToGroupChat(): void {
    if (!this.groupChat) return;
    this.groupChatService.setCurrentGroupChat(this.groupChat);
    this.router.navigate(['/main-container/group-chat', this.groupChat.id]);
  }

  cancel(): void {
    this.router.navigate(['/main-container']);
  }

  private getUserEmail(): string {
    // TODO: Obtener del servicio de autenticación cuando esté implementado
    return 'usuario@ejemplo.com';
  }

  private getUserName(): string {
    // TODO: Obtener del servicio de autenticación cuando esté implementado
    return 'Usuario Ejemplo';
  }

  getMemberInitials(email: string): string {
    const name = this.groupChat?.memberNames?.[email] || email;
    return name.charAt(0).toUpperCase();
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'hoy';
    } else if (diffDays === 1) {
      return 'ayer';
    } else if (diffDays < 7) {
      return `hace ${diffDays} días`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `hace ${months} mes${months > 1 ? 'es' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `hace ${years} año${years > 1 ? 's' : ''}`;
    }
  }
}

