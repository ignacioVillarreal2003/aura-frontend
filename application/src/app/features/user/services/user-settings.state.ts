import { Injectable, signal } from '@angular/core';

export type UserSettingsSection =
  | 'general'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'data-control';

export type UserTheme = 'dark' | 'light' | 'system';

@Injectable({ providedIn: 'root' })
export class UserSettingsState {
  readonly settings = signal({
    theme: 'dark' as UserTheme,
    notifications: {
      email: true,
      sound: false,
    },
    privacy: {
      allowDirectMessages: true,
    },
  });

  readonly themeOptions = [
    { value: 'dark' as const, label: 'Tema oscuro' },
    { value: 'light' as const, label: 'Tema claro' },
    { value: 'system' as const, label: 'Sistema' },
  ];

  readonly passwordFields = signal({
    current: '',
    new: '',
    confirm: '',
  });

  readonly showPasswords = signal({
    current: false,
    new: false,
    confirm: false,
  });

  updateTheme(theme: UserTheme): void {
    this.settings.update((s) => ({ ...s, theme }));
  }

  setNotificationEmail(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, email: value },
    }));
  }

  setNotificationSound(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, sound: value },
    }));
  }

  setAllowDirectMessages(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      privacy: { ...s.privacy, allowDirectMessages: value },
    }));
  }

  setPasswordField(field: 'current' | 'new' | 'confirm', value: string): void {
    this.passwordFields.update((p) => ({ ...p, [field]: value }));
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    this.showPasswords.update((p) => ({ ...p, [field]: !p[field] }));
  }

  onPasswordChange(): void {
    const p = this.passwordFields();
    if (p.new !== p.confirm) {
      alert('Las contraseñas no coinciden');
      return;
    }
    console.log('Cambiando contraseña...', p);
  }
}
