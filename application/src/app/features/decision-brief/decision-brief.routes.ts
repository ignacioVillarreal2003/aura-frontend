import { Routes } from '@angular/router';
import { DecisionBriefPage } from './decision-brief-page/decision-brief-page';

export const DECISION_BRIEF_ROUTES: Routes = [
  {
    path: '',
    component: DecisionBriefPage,
    children: [
      {
        path: ':id',
        title: 'Resumen de decisión',
        loadComponent: () =>
          import('./components/decision-brief-editor/decision-brief-editor').then(
            (m) => m.DecisionBriefEditor,
          ),
      },
    ],
  },
];
