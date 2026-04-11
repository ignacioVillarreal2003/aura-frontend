import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UserSettingsState,
  type UserSettingsSection,
  type UserTheme,
} from '../../services/user-settings.state';

@Component({
  selector: 'app-user-settings-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-settings-content.component.html',
  styleUrl: './user-settings-content.component.css',
})
export class UserSettingsContentComponent {
  readonly section = input.required<UserSettingsSection>();

  readonly store = inject(UserSettingsState);

  onThemeChange(value: string): void {
    this.store.updateTheme(value as UserTheme);
  }
}
