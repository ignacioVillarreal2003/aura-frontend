import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: ':id',
    title: 'Informe',
    loadComponent: () =>
      import('./report-page/report-page').then((m) => m.ReportPage),
  },
  { path: '', pathMatch: 'full', redirectTo: '/main-container/chat-home' },
];
