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

  // ── Artifact viewers (full-screen, own features) ────────────────
  {
    path: 'checklist',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/checklist/checklist.routes').then((m) => m.CHECKLIST_ROUTES),
  },
  {
    path: 'quiz',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/quiz/quiz.routes').then((m) => m.QUIZ_ROUTES),
  },
  {
    path: 'timeline',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/timeline/timeline.routes').then((m) => m.TIMELINE_ROUTES),
  },
  {
    path: 'lessons-learned',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/lessons-learned/lessons-learned.routes').then(
        (m) => m.LESSONS_LEARNED_ROUTES
      ),
  },
  {
    path: 'decision-brief',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/decision-brief/decision-brief.routes').then(
        (m) => m.DECISION_BRIEF_ROUTES
      ),
  },
  {
    path: 'document-summary',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/document-summary/document-summary.routes').then(
        (m) => m.DOCUMENT_SUMMARY_ROUTES
      ),
  },
  {
    path: 'document-action',
    canActivate: [authenticationGuard],
    loadChildren: () =>
      import('./features/document-action/document-action.routes').then(
        (m) => m.DOCUMENT_ACTION_ROUTES
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
