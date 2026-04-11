import { Routes } from '@angular/router';
import { ChatPageComponent } from './components/chat-page/chat-page';

export const chatShellRoutes: Routes = [
  {
    path: '',
    component: ChatPageComponent,
    children: [
      { path: '', redirectTo: 'new-chat', pathMatch: 'full' },
      {
        path: 'new-chat',
        loadChildren: () =>
          import('./new-chat.routes').then((m) => m.NEW_CHAT_ROUTES),
      },
      {
        path: 'chats',
        loadChildren: () =>
          import('./chats.routes').then((m) => m.CHATS_ROUTES),
      },
      {
        path: 'chat',
        loadChildren: () => import('./chat.routes').then((m) => m.chatRoutes),
      },
    ],
  },
];
