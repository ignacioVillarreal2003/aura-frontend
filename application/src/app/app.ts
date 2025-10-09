import { Component, signal } from '@angular/core';
import {AuthPage} from './features/auth/auth-page/auth-page';
import {BtnText} from './shared/components/buttons/btn-text/btn-text';
import {InputText} from './shared/components/inputs/input-text/input-text';
import {Modal} from './shared/components/modals/modal/modal';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('application');

  constructor() {
  }

  ngOnInit() {
  }
}
