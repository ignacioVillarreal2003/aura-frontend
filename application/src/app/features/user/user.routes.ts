import { Routes } from '@angular/router';
import { UserShellPageComponent } from './pages/user-shell-page/user-shell-page';

const settingsSectionLoader = () =>
  import('./pages/user-settings-section-page/user-settings-section-page').then(
    (m) => m.UserSettingsSectionPageComponent
  );

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserShellPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/user-profile-page/user-profile-page').then(
            (m) => m.UserProfilePageComponent
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications-page/notifications-page').then(
            (m) => m.NotificationsPageComponent
          ),
      },
      {
        path: 'general',
        loadComponent: settingsSectionLoader,
        data: { section: 'general' },
      },
      {
        path: 'notification-preferences',
        loadComponent: settingsSectionLoader,
        data: { section: 'notifications' },
      },
      {
        path: 'privacy',
        loadComponent: settingsSectionLoader,
        data: { section: 'privacy' },
      },
      {
        path: 'security',
        loadComponent: settingsSectionLoader,
        data: { section: 'security' },
      },
      {
        path: 'data-control',
        loadComponent: settingsSectionLoader,
        data: { section: 'data-control' },
      },
    ],
  },
];
