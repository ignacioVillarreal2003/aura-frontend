import { Routes } from '@angular/router';
import { DocumentsPage } from './documents-page/documents-page';

export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    component: DocumentsPage,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'search' },
      {
        path: 'search',
        title: 'Documentos',
        loadComponent: () =>
          import('./components/document-search/document-search').then(
            (m) => m.DocumentSearch,
          ),
      },
    ],
  },
];
