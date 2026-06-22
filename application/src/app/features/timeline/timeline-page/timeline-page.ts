import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-timeline-page',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './timeline-page.html',
  styleUrl: './timeline-page.css',
})
export class TimelinePage {}
