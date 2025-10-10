import { Routes } from '@angular/router';

export const userProfileRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/user-profile/user-profile.component').then(m => m.UserProfileComponent)
  }
];
