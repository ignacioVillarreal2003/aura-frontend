import { Routes } from '@angular/router';
import { SharePage } from './share-page/share-page';

export const SHARE_ROUTES: Routes = [
  {
    path: ':token',
    title: 'Conversación compartida · AURA',
    component: SharePage,
  },
];
