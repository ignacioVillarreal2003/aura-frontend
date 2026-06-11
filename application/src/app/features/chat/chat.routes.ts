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
      {
        path: 'assistants',
        loadComponent: () =>
          import('./components/herramientas/asistentes-hub.component').then(
            (m) => m.AsistentesHubComponent
          ),
      },
      {
        path: 'document-search',
        loadComponent: () =>
          import('./components/document-search/document-search.component').then(
            (m) => m.DocumentSearchComponent
          ),
      },
      {
        path: 'feedback-analytics',
        loadComponent: () =>
          import('./components/feedback-analytics/feedback-analytics.component').then(
            (m) => m.FeedbackAnalyticsComponent
          ),
      },
    ],
  },
];
