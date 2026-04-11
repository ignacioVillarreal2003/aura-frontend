import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile-page.html',
  styleUrls: ['./user-profile-page.css'],
})
export class UserProfilePageComponent {
  user = {
    name: 'Emiliano Fau',
    email: 'emiliano.fau@aura.com',
    role: 'Operador',
    department: 'Soporte Técnico',
    phone: '+54 11 1234-5678',
    location: 'Montevideo, Uruguay',
    joinDate: 'Enero 2024',
    avatar: 'E',
  };

  profileSettings = {
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    privacy: {
      showEmail: true,
      showPhone: false,
      showLocation: true,
    },
    preferences: {
      language: 'es',
      theme: 'dark',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  };

  isEditing = false;
  editedUser = { ...this.user };

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editedUser = { ...this.user };
    }
  }

  saveChanges() {
    this.user = { ...this.editedUser };
    this.isEditing = false;
    console.log('Cambios guardados:', this.user);
  }

  cancelEdit() {
    this.editedUser = { ...this.user };
    this.isEditing = false;
  }

  updateNotificationSetting(type: string, value: boolean) {
    this.profileSettings.notifications[
      type as keyof typeof this.profileSettings.notifications
    ] = value;
  }

  updatePrivacySetting(type: string, value: boolean) {
    this.profileSettings.privacy[type as keyof typeof this.profileSettings.privacy] = value;
  }
}
