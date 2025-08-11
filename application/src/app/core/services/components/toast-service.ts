import { Injectable } from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Toast} from '../../../shared/components/toasts/toast/toast';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private snackBar: MatSnackBar) {}

  show(message: string, type: 'success' | 'error' = 'success', duration = 5000): void {
    this.snackBar.openFromComponent(Toast, {
      duration,
      data: { message, type },
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
}
