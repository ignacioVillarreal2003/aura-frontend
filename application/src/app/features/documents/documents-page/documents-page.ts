import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './documents-page.html',
  styleUrls: ['./documents-page.css'],
})
export class DocumentsPage {}
