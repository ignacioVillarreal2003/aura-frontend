import { Routes } from '@angular/router';
import { authenticationGuard } from './core/guards/authentication.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    title: 'Iniciar sesión',
    loadComponent: () =>
      import('./features/authentication/pages/login-page/login-page').then(m => m.LoginPage)
  },

  {
    path: 'main-container',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/chat/chat.routes').then((m) => m.chatShellRoutes),
  },

  // ── Reports (full-screen, own feature) ──────────────────────────
  {
    path: 'report',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/report/report.routes').then((m) => m.REPORT_ROUTES),
  },

  // ── Artifact viewers (full-screen, no sidebar) ──────────────────
  {
    path: 'checklist/:id',
    title: 'Checklist',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/checklist-editor/checklist-editor').then(
        (m) => m.ChecklistEditor
      ),
  },
  {
    path: 'quiz/:id',
    title: 'Quiz',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/quiz-editor/quiz-editor').then(
        (m) => m.QuizEditor
      ),
  },
  {
    path: 'timeline/:id',
    title: 'Línea de tiempo',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/timeline-editor/timeline-editor').then(
        (m) => m.TimelineEditor
      ),
  },
  {
    path: 'lessons-learned/:id',
    title: 'Lecciones aprendidas',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/lessons-learned-editor/lessons-learned-editor').then(
        (m) => m.LessonsLearnedEditor
      ),
  },
  {
    path: 'decision-brief/:id',
    title: 'Resumen de decisión',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/decision-brief-editor/decision-brief-editor').then(
        (m) => m.DecisionBriefEditor
      ),
  },
  {
    path: 'document-summary/:id',
    title: 'Resumen de documento',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/document-summary-editor/document-summary-editor').then(
        (m) => m.DocumentSummaryEditor
      ),
  },
  {
    path: 'document-action/:id',
    title: 'Acción de documento',
    canActivate: [authenticationGuard],
    loadComponent: () =>
      import('./features/chat/components/document-action-editor/document-action-editor').then(
        (m) => m.DocumentActionEditor
      ),
  },

  {
    path: 'documents',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
  },

  {
    path: 'user',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },

  {
    path: 'share',
    loadChildren: () =>
      import('./features/share/share.routes').then((m) => m.SHARE_ROUTES),
  },

  { path: '**', redirectTo: 'login' }
];
