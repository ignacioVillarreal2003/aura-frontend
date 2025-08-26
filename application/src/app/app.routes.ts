import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'main-chat',
    loadChildren: () =>
      import('./features/main-chat/main-chat.routes').then(m => m.routes)
  },

  { path: '', redirectTo: 'main-chat', pathMatch: 'full' },
  { path: '**', redirectTo: 'main-chat' }
];
