import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent {
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
}
