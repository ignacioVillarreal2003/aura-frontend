import {Component, input} from '@angular/core';

@Component({
  selector: 'app-input-text',
  imports: [],
  templateUrl: './input-text.html',
  styleUrl: './input-text.css'
})
export class InputText {
  id: any;
  readonly placeholder = input<string>();
  readonly label = input<string>();
  readonly error = input<string>();
  readonly disabled = input<boolean>(false);
  readonly inputType = input<'text' | 'password'>('text');

  ngOnInit(): void {
    this.id = crypto.randomUUID();
  }
}
