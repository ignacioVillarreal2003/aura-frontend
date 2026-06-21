import { Routes } from '@angular/router';
import { ChatPage } from './chat-page/chat-page';

export const chatShellRoutes: Routes = [
  {
    path: '',
    component: ChatPage,
    children: [
      { path: '', redirectTo: 'chat-home', pathMatch: 'full' },
      {
        path: 'chat-home',
        title: 'Inicio',
        loadComponent: () =>
          import('./components/chat-home/chat-home').then((m) => m.ChatHome),
      },
      {
        path: 'chats',
        title: 'Chats',
        loadComponent: () =>
          import('./components/chat-search/chat-search').then(
            (m) => m.ChatSearch
          ),
      },
      {
        path: 'chat/:id',
        title: 'Chat',
        loadComponent: () =>
          import('./components/chat-session/chat-session').then((m) => m.ChatSession),
      },
      {
        path: 'assistants',
        title: 'Asistentes',
        loadComponent: () =>
          import('./components/herramientas/asistentes-hub').then(
            (m) => m.AsistentesHub
          ),
      },
      {
        path: 'feedback-analytics',
        title: 'Analíticas',
        loadComponent: () =>
          import('./components/feedback-analytics/feedback-analytics').then(
            (m) => m.FeedbackAnalytics
          ),
      },
    ],
  },
];
