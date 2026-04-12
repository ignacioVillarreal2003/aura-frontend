import { Routes } from '@angular/router';
import { ChatPageComponent } from './chat-page/chat-page';

export const chatShellRoutes: Routes = [
  {
    path: '',
    component: ChatPageComponent,
    children: [
      { path: '', redirectTo: 'chat-home', pathMatch: 'full' },
      {
        path: 'chat-home',
        loadComponent: () =>
          import('./components/chat-home/chat-home').then((m) => m.ChatHomeComponent),
      },
      {
        path: 'chats',
        loadComponent: () =>
          import('./components/chat-search/chat-search.component').then(
            (m) => m.ChatSearchComponent
          ),
      },
      {
        path: 'chat/:id',
        loadComponent: () =>
          import('./components/chat-session/chat-session').then((m) => m.ChatSessionComponent),
      },
    ],
  },
];
