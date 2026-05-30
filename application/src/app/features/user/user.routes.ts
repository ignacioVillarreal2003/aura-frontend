import { Routes } from '@angular/router';
import { UserPageComponent } from './user-page/user-page';

const settingsSectionLoader = () =>
  import('./components/user-settings-section/user-settings-section.component').then(
    (m) => m.UserSettingsSectionComponent,
  );

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () =>
          import('./components/user-profile/user-profile.component').then((m) => m.UserProfileComponent),
      },
      {
        path: 'invitations',
        loadComponent: () =>
          import('./components/user-invitations/user-invitations.component').then(
            (m) => m.UserInvitationsComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./components/user-notifications/user-notifications.component').then(
            (m) => m.UserNotificationsComponent,
          ),
      },
      {
        path: 'general',
        loadComponent: settingsSectionLoader,
        data: { section: 'general' },
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
