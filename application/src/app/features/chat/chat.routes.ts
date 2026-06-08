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
        path: 'report/:id',
        loadComponent: () =>
          import('./components/report-editor/report-editor').then((m) => m.ReportEditorComponent),
      },
      {
        path: 'checklist/:id',
        loadComponent: () =>
          import('./components/checklist-editor/checklist-editor').then(
            (m) => m.ChecklistEditorComponent
          ),
      },
      {
        path: 'quiz/:id',
        loadComponent: () =>
          import('./components/quiz-editor/quiz-editor').then((m) => m.QuizEditorComponent),
      },
      {
        path: 'timeline/:id',
        loadComponent: () =>
          import('./components/timeline-editor/timeline-editor').then(
            (m) => m.TimelineEditorComponent
          ),
      },
      {
        path: 'lessons-learned/:id',
        loadComponent: () =>
          import('./components/lessons-learned-editor/lessons-learned-editor').then(
            (m) => m.LessonsLearnedEditorComponent
          ),
      },
      {
        path: 'decision-brief/:id',
        loadComponent: () =>
          import('./components/decision-brief-editor/decision-brief-editor').then(
            (m) => m.DecisionBriefEditorComponent
          ),
      },
      {
        path: 'document-summary/:id',
        loadComponent: () =>
          import('./components/document-summary-editor/document-summary-editor').then(
            (m) => m.DocumentSummaryEditorComponent
          ),
      },
      {
        path: 'document-action/:id',
        loadComponent: () =>
          import('./components/document-action-editor/document-action-editor').then(
            (m) => m.DocumentActionEditorComponent
          ),
      },
      {
        path: 'assistants',
        loadComponent: () =>
          import('./components/herramientas/asistentes-hub.component').then(
            (m) => m.AsistentesHubComponent
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
