import { Injectable, signal } from '@angular/core';

/** Secciones de ajustes cargadas bajo `/user/...` (no incluye perfil ni bandeja de notificaciones). */
export type UserSettingsSection = 'general' | 'privacy' | 'security' | 'data-control';

export type UserTheme = 'dark' | 'light' | 'system';

const THEME_KEY = 'aura-theme';

@Injectable({ providedIn: 'root' })
export class UserSettingsState {
  readonly settings = signal({
    theme: ((localStorage.getItem(THEME_KEY) as UserTheme) ?? 'dark'),
    notifications: {
      email: true,
      sound: false,
      push: true,
      sms: false,
    },
    privacy: {
      allowDirectMessages: true,
      showEmail: true,
      showPhone: false,
      showLocation: true,
    },
  });

  constructor() {
    this.applyTheme(this.settings().theme);
  }

  private applyTheme(theme: UserTheme): void {
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-light');
    const effective = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    body.classList.add(`theme-${effective}`);
  }

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
    localStorage.setItem(THEME_KEY, theme);
    this.applyTheme(theme);
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

  setNotificationPush(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, push: value },
    }));
  }

  setNotificationSms(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, sms: value },
    }));
  }

  setAllowDirectMessages(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      privacy: { ...s.privacy, allowDirectMessages: value },
    }));
  }

  setShowEmailPublic(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      privacy: { ...s.privacy, showEmail: value },
    }));
  }

  setShowPhonePublic(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      privacy: { ...s.privacy, showPhone: value },
    }));
  }

  setShowLocationPublic(value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      privacy: { ...s.privacy, showLocation: value },
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
