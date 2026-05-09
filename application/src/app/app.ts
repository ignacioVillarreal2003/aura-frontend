import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserSettingsState } from './core/state/user-settings.state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor() {
    inject(UserSettingsState);
  }
}
