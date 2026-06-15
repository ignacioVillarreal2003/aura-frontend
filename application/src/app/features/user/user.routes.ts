import { Routes } from '@angular/router';
import { UserPage } from './user-page/user-page';

const settingsSectionLoader = () =>
  import('./components/user-settings-section/user-settings-section').then(
    (m) => m.UserSettingsSectionComponent,
  );

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserPage,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        title: 'Perfil',
        loadComponent: () =>
          import('./components/user-profile/user-profile').then((m) => m.UserProfile),
      },
      {
        path: 'invitations',
        title: 'Invitaciones',
        loadComponent: () =>
          import('./components/user-invitations/user-invitations').then(
            (m) => m.UserInvitations,
          ),
      },
      {
        path: 'notifications',
        title: 'Notificaciones',
        loadComponent: () =>
          import('./components/user-notifications/user-notifications').then(
            (m) => m.UserNotifications,
          ),
        data: { tab: 'inbox' },
      },
      {
        path: 'notifications/preferences',
        title: 'Preferencias de notificaciones',
        loadComponent: () =>
          import('./components/user-notifications/user-notifications').then(
            (m) => m.UserNotifications,
          ),
        data: { tab: 'preferences' },
      },
      {
        path: 'security',
        title: 'Contraseña',
        loadComponent: settingsSectionLoader,
        data: { section: 'security' },
      },
      {
        path: 'data-control',
        title: 'Control de datos',
        loadComponent: settingsSectionLoader,
        data: { section: 'data-control' },
      },
    ],
  },
];
