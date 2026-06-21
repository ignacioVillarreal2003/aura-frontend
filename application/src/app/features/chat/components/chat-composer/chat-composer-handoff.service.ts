import { Injectable } from '@angular/core';
import type { ComposerAudio } from './chat-composer';

/**
 * Carries a voice recording captured on the home screen across the navigation
 * to the freshly created chat, where it is processed exactly like an in-session
 * recording. Kept in memory (not router state) so the audio Blob is not subject
 * to history-state size limits.
 */
@Injectable({ providedIn: 'root' })
export class ChatComposerHandoffService {
  private _pendingAudio: ComposerAudio | null = null;

  setPendingAudio(audio: ComposerAudio): void {
    this._pendingAudio = audio;
  }

  consumePendingAudio(): ComposerAudio | null {
    const audio = this._pendingAudio;
    this._pendingAudio = null;
    return audio;
  }
}
