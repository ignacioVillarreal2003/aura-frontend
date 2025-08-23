import { Component } from '@angular/core';
import {InputText} from '../../../shared/components/inputs/input-text/input-text';
import {BtnText} from '../../../shared/components/buttons/btn-text/btn-text';

@Component({
  selector: 'app-login-form',
  imports: [
    InputText,
    BtnText
  ],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})
export class LoginForm {

}
