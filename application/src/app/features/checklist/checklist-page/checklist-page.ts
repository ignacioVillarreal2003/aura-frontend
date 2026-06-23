import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-checklist-page',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './checklist-page.html',
  styleUrl: './checklist-page.css',
})
export class ChecklistPage {}
