import {Component, Inject} from '@angular/core';
import {NgClass} from '@angular/common';
import {MAT_SNACK_BAR_DATA, MatSnackBarRef} from '@angular/material/snack-bar';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-toast',
  imports: [
    NgClass,
    MatIcon
  ],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class Toast {
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: { message: string; type: string },
              private snackRef: MatSnackBarRef<Toast>) {}

  close(): void {
    this.snackRef.dismiss();
  }
}
