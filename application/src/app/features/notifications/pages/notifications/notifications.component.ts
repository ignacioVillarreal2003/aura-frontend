import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Notification {
  id: string;
  type: 'invitation' | 'message' | 'mention' | 'system';
  sender: string;
  senderEmail?: string;
  title: string;
  description?: string;
  timestamp: Date;
  isRead: boolean;
  actions: NotificationAction[];
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: () => void;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  notifications: Notification[] = [
    {
      id: '1',
      type: 'invitation',
      sender: 'Paco Julio',
      senderEmail: 'Paco23@gmail.com',
      title: 'Invitación',
      description: 'Te ha invitado a un chat grupal',
      timestamp: new Date('2024-01-15T10:30:00'),
      isRead: false,
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          type: 'primary',
          action: () => this.acceptInvitation('1')
        },
        {
          id: 'decline',
          label: 'Declinar',
          type: 'danger',
          action: () => this.declineInvitation('1')
        }
      ]
    },
    {
      id: '2',
      type: 'message',
      sender: 'Administrador',
      title: 'Mensaje',
      description: 'Nuevo mensaje en el chat de soporte',
      timestamp: new Date('2024-01-15T09:15:00'),
      isRead: false,
      actions: [
        {
          id: 'view',
          label: 'Ver',
          type: 'primary',
          action: () => this.viewMessage('2')
        }
      ]
    },
    {
      id: '3',
      type: 'mention',
      sender: 'Paco Julio',
      senderEmail: 'Paco23@gmail.com',
      title: 'Mención',
      description: 'Te mencionó en un chat',
      timestamp: new Date('2024-01-15T08:45:00'),
      isRead: true,
      actions: [
        {
          id: 'go',
          label: 'Ir',
          type: 'primary',
          action: () => this.goToMention('3')
        }
      ]
    },
    {
      id: '4',
      type: 'system',
      sender: 'Sistema',
      title: 'Actualización',
      description: 'Nueva versión disponible',
      timestamp: new Date('2024-01-14T16:20:00'),
      isRead: true,
      actions: [
        {
          id: 'update',
          label: 'Actualizar',
          type: 'primary',
          action: () => this.updateSystem('4')
        }
      ]
    },
    {
      id: '5',
      type: 'invitation',
      sender: 'María González',
      senderEmail: 'maria.gonzalez@empresa.com',
      title: 'Invitación',
      description: 'Te ha invitado a un proyecto',
      timestamp: new Date('2024-01-14T14:30:00'),
      isRead: false,
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          type: 'primary',
          action: () => this.acceptInvitation('5')
        },
        {
          id: 'decline',
          label: 'Declinar',
          type: 'danger',
          action: () => this.declineInvitation('5')
        }
      ]
    }
  ];

  acceptInvitation(notificationId: string) {
    console.log('Aceptando invitación:', notificationId);
    this.markAsRead(notificationId);
  }

  declineInvitation(notificationId: string) {
    console.log('Declinando invitación:', notificationId);
    this.markAsRead(notificationId);
  }

  viewMessage(notificationId: string) {
    console.log('Viendo mensaje:', notificationId);
    this.markAsRead(notificationId);
  }

  goToMention(notificationId: string) {
    console.log('Yendo a mención:', notificationId);
    this.markAsRead(notificationId);
  }

  updateSystem(notificationId: string) {
    console.log('Actualizando sistema:', notificationId);
    this.markAsRead(notificationId);
  }

  markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
    }
  }

  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.isRead = true;
    });
  }

  deleteNotification(notificationId: string) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
  }

  getSenderInitials(sender: string): string {
    return sender.split(' ').map(name => name.charAt(0)).join('').toUpperCase();
  }

  getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `hace ${minutes} min`;
    } else if (hours < 24) {
      return `hace ${hours}h`;
    } else {
      return `hace ${days} días`;
    }
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }
}
