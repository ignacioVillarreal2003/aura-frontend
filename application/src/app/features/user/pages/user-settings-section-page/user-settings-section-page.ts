import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import type { UserSettingsSection } from '../../services/user-settings.state';
import { UserSettingsContentComponent } from '../../components/user-settings-content/user-settings-content.component';

@Component({
  selector: 'app-user-settings-section-page',
  standalone: true,
  imports: [UserSettingsContentComponent],
  templateUrl: './user-settings-section-page.html',
  styleUrl: './user-settings-section-page.css',
})
export class UserSettingsSectionPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly section = toSignal(
    this.route.data.pipe(map((d) => d['section'] as UserSettingsSection)),
    { initialValue: this.route.snapshot.data['section'] as UserSettingsSection }
  );
}
