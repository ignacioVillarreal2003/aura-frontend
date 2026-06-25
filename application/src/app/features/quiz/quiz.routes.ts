import { Routes } from '@angular/router';
import { QuizPage } from './quiz-page/quiz-page';

export const QUIZ_ROUTES: Routes = [
  {
    path: '',
    component: QuizPage,
    children: [
      {
        path: ':id',
        title: 'Quiz',
        loadComponent: () =>
          import('./components/quiz-editor/quiz-editor').then(
            (m) => m.QuizEditor,
          ),
      },
    ],
  },
];
