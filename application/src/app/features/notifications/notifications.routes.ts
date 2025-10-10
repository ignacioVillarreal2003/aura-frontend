import { Routes } from '@angular/router';

export const notificationsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent)
  }
];
