import { Routes } from '@angular/router';
import { TimelinePage } from './timeline-page/timeline-page';

export const TIMELINE_ROUTES: Routes = [
  {
    path: '',
    component: TimelinePage,
    children: [
      {
        path: ':id',
        title: 'Línea de tiempo',
        loadComponent: () =>
          import('./components/timeline-editor/timeline-editor').then(
            (m) => m.TimelineEditor,
          ),
      },
    ],
  },
];
