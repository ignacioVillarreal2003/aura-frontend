import { Routes } from '@angular/router';

export const groupChatRoutes: Routes = [
  { 
    path: ':id', 
    loadComponent: () => 
      import('./pages/group-chat/group-chat.component').then(m => m.GroupChatComponent)
  }
];



