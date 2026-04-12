import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/authentication/pages/login-page/login-page').then(m => m.LoginPage)
  },
  {
    path: 'main-container',
    loadChildren: () =>
      import('./features/chat/chat.routes').then((m) => m.chatShellRoutes),
  },

  {
    path: 'user',
    loadChildren: () =>
      import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },

  {
    path: 'join-group/:linkId',
    loadChildren: () =>
      import('./features/deprecated/join-group-chat/join-group-chat.routes').then(
        (m) => m.joinGroupChatRoutes
      ),
  },

  { path: '**', redirectTo: 'login' }
];
