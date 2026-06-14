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
        loadComponent: () =>
          import('./components/user-profile/user-profile').then((m) => m.UserProfile),
      },
      {
        path: 'invitations',
        loadComponent: () =>
          import('./components/user-invitations/user-invitations').then(
            (m) => m.UserInvitations,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./components/user-notifications/user-notifications').then(
            (m) => m.UserNotifications,
          ),
        data: { tab: 'inbox' },
      },
      {
        path: 'notifications/preferences',
        loadComponent: () =>
          import('./components/user-notifications/user-notifications').then(
            (m) => m.UserNotifications,
          ),
        data: { tab: 'preferences' },
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
