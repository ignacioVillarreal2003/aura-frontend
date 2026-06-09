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

  // ── Artifact viewers (full-screen, no sidebar) ──────────────────
  {
    path: 'report/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/report-editor/report-editor').then(
        (m) => m.ReportEditorComponent
      ),
  },
  {
    path: 'checklist/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/checklist-editor/checklist-editor').then(
        (m) => m.ChecklistEditorComponent
      ),
  },
  {
    path: 'quiz/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/quiz-editor/quiz-editor').then(
        (m) => m.QuizEditorComponent
      ),
  },
  {
    path: 'timeline/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/timeline-editor/timeline-editor').then(
        (m) => m.TimelineEditorComponent
      ),
  },
  {
    path: 'lessons-learned/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/lessons-learned-editor/lessons-learned-editor').then(
        (m) => m.LessonsLearnedEditorComponent
      ),
  },
  {
    path: 'decision-brief/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/decision-brief-editor/decision-brief-editor').then(
        (m) => m.DecisionBriefEditorComponent
      ),
  },
  {
    path: 'document-summary/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/document-summary-editor/document-summary-editor').then(
        (m) => m.DocumentSummaryEditorComponent
      ),
  },
  {
    path: 'document-action/:id',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/document-action-editor/document-action-editor').then(
        (m) => m.DocumentActionEditorComponent
      ),
  },

  {
    path: 'user',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },

  {
    path: 'share/:token',
    loadComponent: () =>
      import('./features/chat/components/public-share/public-share').then(
        (m) => m.PublicShareComponent
      ),
  },

  { path: '**', redirectTo: 'login' }
];
