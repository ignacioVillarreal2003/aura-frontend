import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import type { UserSettingsSection } from '@core/state/user-settings.state';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserSettingsState } from '@core/state/user-settings.state';

@Component({
  selector: 'app-user-settings-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-settings-section.html',
  styleUrls: ['./user-settings-section.css'],
})
export class UserSettingsSectionComponent {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(UserSettingsState);

  readonly section = toSignal(
    this.route.data.pipe(map((d) => d['section'] as UserSettingsSection)),
    { initialValue: this.route.snapshot.data['section'] as UserSettingsSection },
  );
}
