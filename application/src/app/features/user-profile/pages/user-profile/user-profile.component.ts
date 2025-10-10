import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent {
  // Datos del usuario
  user = {
    name: 'Emiliano Fau',
    email: 'emiliano.fau@aura.com',
    role: 'Operador',
    department: 'Soporte Técnico',
    phone: '+54 11 1234-5678',
    location: 'Montevideo, Uruguay',
    joinDate: 'Enero 2024',
    avatar: 'E'
  };

  // Configuraciones de perfil
  profileSettings = {
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    privacy: {
      showEmail: true,
      showPhone: false,
      showLocation: true
    },
    preferences: {
      language: 'es',
      theme: 'dark',
      timezone: 'America/Argentina/Buenos_Aires'
    }
  };

  // Estado de edición
  isEditing = false;
  editedUser = { ...this.user };

  // Métodos
  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editedUser = { ...this.user };
    }
  }

  saveChanges() {
    this.user = { ...this.editedUser };
    this.isEditing = false;
    // Aquí podrías hacer una llamada a la API para guardar los cambios
    console.log('Cambios guardados:', this.user);
  }

  cancelEdit() {
    this.editedUser = { ...this.user };
    this.isEditing = false;
  }

  updateNotificationSetting(type: string, value: boolean) {
    this.profileSettings.notifications[type as keyof typeof this.profileSettings.notifications] = value;
  }

  updatePrivacySetting(type: string, value: boolean) {
    this.profileSettings.privacy[type as keyof typeof this.profileSettings.privacy] = value;
  }
}
