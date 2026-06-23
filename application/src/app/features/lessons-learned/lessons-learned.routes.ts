import { Routes } from '@angular/router';
import { LessonsLearnedPage } from './lessons-learned-page/lessons-learned-page';

export const LESSONS_LEARNED_ROUTES: Routes = [
  {
    path: '',
    component: LessonsLearnedPage,
    children: [
      {
        path: ':id',
        title: 'Lecciones aprendidas',
        loadComponent: () =>
          import('./components/lessons-learned-editor/lessons-learned-editor').then(
            (m) => m.LessonsLearnedEditor,
          ),
      },
    ],
  },
];
