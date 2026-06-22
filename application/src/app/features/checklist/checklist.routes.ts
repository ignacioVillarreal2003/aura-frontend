import { Routes } from '@angular/router';
import { ChecklistPage } from './checklist-page/checklist-page';

export const CHECKLIST_ROUTES: Routes = [
  {
    path: '',
    component: ChecklistPage,
    children: [
      {
        path: ':id',
        title: 'Checklist',
        loadComponent: () =>
          import('./components/checklist-editor/checklist-editor').then(
            (m) => m.ChecklistEditor,
          ),
      },
    ],
  },
];
