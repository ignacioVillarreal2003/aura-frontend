import { Routes } from '@angular/router';
import {MainContainerComponent} from './pages/main-container.component';

export const routes: Routes = [
  { 
    path: '', 
    component: MainContainerComponent,
    children: [
      { path: '', redirectTo: 'new-chat', pathMatch: 'full' },
      {
        path: 'new-chat',
        loadChildren: () =>
          import('../new-chat/new-chat.routes').then(m => m.NEW_CHAT_ROUTES)
      },
      {
        path: 'group-chat',
        loadChildren: () =>
          import('../group-chat/group-chat.routes').then(m => m.groupChatRoutes)
      },
      {
        path: 'user-profile',
        loadChildren: () =>
          import('../user-profile/user-profile.routes').then(m => m.userProfileRoutes)
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('../notifications/notifications.routes').then(m => m.notificationsRoutes)
      }
    ]
  },
];
