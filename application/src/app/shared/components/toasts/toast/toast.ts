import {Component, inject} from '@angular/core';
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
  readonly data = inject<{ message: string; type: string }>(MAT_SNACK_BAR_DATA);
  private readonly snackRef = inject<MatSnackBarRef<Toast>>(MatSnackBarRef);

  close(): void {
    this.snackRef.dismiss();
  }
}
