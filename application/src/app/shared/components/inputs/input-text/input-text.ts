import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-input-text',
  imports: [],
  templateUrl: './input-text.html',
  styleUrl: './input-text.css'
})
export class InputText {
  id: any;
  @Input() placeholder: string | undefined;
  @Input() label: string | undefined;
  @Input() error: string | undefined;
  @Input() disabled: boolean = false;
  @Input() type: 'text' | 'password' = 'text';

  ngOnInit(): void {
    this.id = crypto.randomUUID();
  }
}
