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
        loadComponent: () =>
          import('./components/chat-home/chat-home').then((m) => m.ChatHome),
      },
      {
        path: 'chats',
        loadComponent: () =>
          import('./components/chat-search/chat-search').then(
            (m) => m.ChatSearch
          ),
      },
      {
        path: 'chat/:id',
        loadComponent: () =>
          import('./components/chat-session/chat-session').then((m) => m.ChatSession),
      },
      {
        path: 'assistants',
        loadComponent: () =>
          import('./components/herramientas/asistentes-hub').then(
            (m) => m.AsistentesHub
          ),
      },
      {
        path: 'document-search',
        loadComponent: () =>
          import('./components/document-search/document-search').then(
            (m) => m.DocumentSearch
          ),
      },
      {
        path: 'feedback-analytics',
        loadComponent: () =>
          import('./components/feedback-analytics/feedback-analytics').then(
            (m) => m.FeedbackAnalytics
          ),
      },
    ],
  },
];
