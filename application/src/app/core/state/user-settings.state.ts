import { Injectable, signal } from '@angular/core';

export type UserSettingsSection = 'general' | 'privacy' | 'security' | 'data-control';

type Theme = 'dark' | 'light' | 'system';
type PasswordField = 'current' | 'new' | 'confirm';

interface UserSettings {
  theme: Theme;
  privacy: {
    allowDirectMessages: boolean;
    showEmail: boolean;
    showPhone: boolean;
    showLocation: boolean;
  };
  notifications: {
    email: boolean;
    sound: boolean;
    push: boolean;
    sms: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class UserSettingsState {
  readonly settings = signal<UserSettings>({
    theme: 'system',
    privacy: {
      allowDirectMessages: true,
      showEmail: false,
      showPhone: false,
      showLocation: false,
    },
    notifications: {
      email: true,
      sound: true,
      push: true,
      sms: false,
    },
  });

  readonly themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];

  readonly showPasswords = signal<Record<PasswordField, boolean>>({
    current: false,
    new: false,
    confirm: false,
  });

  readonly passwordFields = signal<Record<PasswordField, string>>({
    current: '',
    new: '',
    confirm: '',
  });

  updateTheme(theme: Theme): void {
    this.settings.update((s) => ({ ...s, theme }));
  }

  setAllowDirectMessages(value: boolean): void {
    this.settings.update((s) => ({ ...s, privacy: { ...s.privacy, allowDirectMessages: value } }));
  }

  setShowEmailPublic(value: boolean): void {
    this.settings.update((s) => ({ ...s, privacy: { ...s.privacy, showEmail: value } }));
  }

  setShowPhonePublic(value: boolean): void {
    this.settings.update((s) => ({ ...s, privacy: { ...s.privacy, showPhone: value } }));
  }

  setShowLocationPublic(value: boolean): void {
    this.settings.update((s) => ({ ...s, privacy: { ...s.privacy, showLocation: value } }));
  }

  setNotificationEmail(value: boolean): void {
    this.settings.update((s) => ({ ...s, notifications: { ...s.notifications, email: value } }));
  }

  setNotificationSound(value: boolean): void {
    this.settings.update((s) => ({ ...s, notifications: { ...s.notifications, sound: value } }));
  }

  setNotificationPush(value: boolean): void {
    this.settings.update((s) => ({ ...s, notifications: { ...s.notifications, push: value } }));
  }

  setNotificationSms(value: boolean): void {
    this.settings.update((s) => ({ ...s, notifications: { ...s.notifications, sms: value } }));
  }

  togglePasswordVisibility(field: PasswordField): void {
    this.showPasswords.update((s) => ({ ...s, [field]: !s[field] }));
  }

  setPasswordField(field: PasswordField, value: string): void {
    this.passwordFields.update((s) => ({ ...s, [field]: value }));
  }

  onPasswordChange(): void {
    const { current, new: newPwd, confirm } = this.passwordFields();
    if (!current || !newPwd || !confirm) return;
    if (newPwd !== confirm) return;
    this.passwordFields.set({ current: '', new: '', confirm: '' });
    this.showPasswords.set({ current: false, new: false, confirm: false });
  }
}
