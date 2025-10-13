import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-configuration-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuration-modal.component.html',
  styleUrls: ['./configuration-modal.component.css']
})
export class ConfigurationModalComponent {
  @Output() close = new EventEmitter<void>();

  selectedSection = 'general';

  settings = {
    theme: 'dark',
    notifications: {
      email: true,
      sound: false
    },
    privacy: {
      allowDirectMessages: true
    }
  };

  themeOptions = [
    { value: 'dark', label: 'Tema oscuro' },
    { value: 'light', label: 'Tema claro' },
    { value: 'system', label: 'Sistema' }
  ];


  passwordFields = {
    current: '',
    new: '',
    confirm: ''
  };

  showPasswords = {
    current: false,
    new: false,
    confirm: false
  };

  onClose() {
    this.close.emit();
  }

  onSave() {
    console.log('Guardando configuración:', this.settings);
    this.onClose();
  }

  onCancel() {
    this.onClose();
  }

  onPasswordChange() {
    if (this.passwordFields.new !== this.passwordFields.confirm) {
      alert('Las contraseñas no coinciden');
      return;
    }
    console.log('Cambiando contraseña...', this.passwordFields);
  }

  toggleNotification(type: string) {
    this.settings.notifications[type as keyof typeof this.settings.notifications] = 
      !this.settings.notifications[type as keyof typeof this.settings.notifications];
  }

  togglePrivacy(type: string) {
    this.settings.privacy[type as keyof typeof this.settings.privacy] = 
      !this.settings.privacy[type as keyof typeof this.settings.privacy];
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm') {
    this.showPasswords[field] = !this.showPasswords[field];
  }

  selectSection(section: string) {
    this.selectedSection = section;
  }

  onManageSharedLinks() {
    console.log('Administrando enlaces compartidos...');
    // Aquí iría la lógica para administrar enlaces compartidos
  }

  onManageArchivedChats() {
    console.log('Administrando chats archivados...');
    // Aquí iría la lógica para administrar chats archivados
  }

  onArchiveAllChats() {
    console.log('Archivando todos los chats...');
    // Aquí iría la lógica para archivar todos los chats
  }

  onDeleteAllChats() {
    console.log('Eliminando todos los chats...');
    // Aquí iría la lógica para eliminar todos los chats
  }

  onExportData() {
    console.log('Exportando datos del usuario...');
    // Aquí iría la lógica para exportar datos
  }
}
