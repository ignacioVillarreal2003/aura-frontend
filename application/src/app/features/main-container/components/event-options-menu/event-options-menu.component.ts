import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MenuOption {
  id: string;
  label: string;
  icon: string;
  action: 'navigate' | 'modal' | 'logout';
  danger?: boolean;
}

@Component({
  selector: 'app-event-options-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-options-menu.component.html',
  styleUrls: ['./event-options-menu.component.css']
})
export class EventOptionsMenuComponent {
  @Output() close = new EventEmitter<void>();
  @Output() optionSelected = new EventEmitter<string>();

  menuOptions: MenuOption[] = [
    {
      id: 'profile',
      label: 'Mi Perfil',
      icon: 'pi-user',
      action: 'navigate'
    },
    {
      id: 'notifications',
      label: 'Notificaciones',
      icon: 'pi-bell',
      action: 'navigate'
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: 'pi-cog',
      action: 'modal'
    },
    {
      id: 'logout',
      label: 'Cerrar sesión',
      icon: 'pi-sign-out',
      action: 'logout',
      danger: true
    }
  ];

  onClose() {
    this.close.emit();
  }

  onOptionClick(optionId: string) {
    this.optionSelected.emit(optionId);
    this.onClose();
  }
}

