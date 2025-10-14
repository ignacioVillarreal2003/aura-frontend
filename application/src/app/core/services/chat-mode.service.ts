import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatModeService {
  private _chatMode = signal<'individual' | 'grupal'>('individual');
  
  get chatMode() {
    return this._chatMode.asReadonly();
  }
  
  setChatMode(mode: 'individual' | 'grupal') {
    this._chatMode.set(mode);
  }
  
  toggleChatMode() {
    const currentMode = this._chatMode();
    this._chatMode.set(currentMode === 'individual' ? 'grupal' : 'individual');
  }
}
