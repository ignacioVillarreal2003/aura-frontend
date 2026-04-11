import { Routes } from '@angular/router';
import { ChatSearchComponent } from './components/chat-search/chat-search.component';

export const CHATS_ROUTES: Routes = [
  {
    path: '',
    component: ChatSearchComponent,
  },
];
