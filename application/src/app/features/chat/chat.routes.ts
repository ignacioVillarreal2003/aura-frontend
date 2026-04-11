import { Routes } from '@angular/router';

export const chatRoutes: Routes = [
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/conversation-page/conversation-page').then(
        (m) => m.ConversationPageComponent
      )
  }
];






