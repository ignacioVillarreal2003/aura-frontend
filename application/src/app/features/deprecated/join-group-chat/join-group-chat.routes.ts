import { Routes } from '@angular/router';

export const joinGroupChatRoutes: Routes = [
  { 
    path: '', 
    loadComponent: () => 
      import('./pages/join-group-chat/join-group-chat.component').then(m => m.JoinGroupChatComponent)
  }
];



