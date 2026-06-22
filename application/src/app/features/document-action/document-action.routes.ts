import { Routes } from '@angular/router';
import { DocumentActionPage } from './document-action-page/document-action-page';

export const DOCUMENT_ACTION_ROUTES: Routes = [
  {
    path: '',
    component: DocumentActionPage,
    children: [
      {
        path: ':id',
        title: 'Acción de documento',
        loadComponent: () =>
          import('./components/document-action-editor/document-action-editor').then(
            (m) => m.DocumentActionEditor,
          ),
      },
    ],
  },
];
