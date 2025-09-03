import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/auth-page/auth-page').then(m => m.AuthPage)
  },

  {
    path: 'main-chat',
    loadChildren: () =>
      import('./features/main-chat/main-chat.routes').then(m => m.routes),
    // canActivate: [authGuard]
  },

  { path: '**', redirectTo: 'login' }
];
