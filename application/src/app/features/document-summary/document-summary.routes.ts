import { Routes } from '@angular/router';
import { DocumentSummaryPage } from './document-summary-page/document-summary-page';

export const DOCUMENT_SUMMARY_ROUTES: Routes = [
  {
    path: '',
    component: DocumentSummaryPage,
    children: [
      {
        path: ':id',
        title: 'Resumen de documento',
        loadComponent: () =>
          import('./components/document-summary-editor/document-summary-editor').then(
            (m) => m.DocumentSummaryEditor,
          ),
      },
    ],
  },
];
