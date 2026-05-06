import { Routes } from '@angular/router';
import { authenticationGuard } from './core/guards/authentication.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/authentication/pages/login-page/login-page').then(m => m.LoginPage)
  },
  {
    path: 'main-container',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/chat/chat.routes').then((m) => m.chatShellRoutes),
  },

  {
    path: 'user',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },

  { path: '**', redirectTo: 'login' }
];
