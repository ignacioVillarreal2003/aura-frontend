import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthenticationService } from '../services/authentication/authentication.service';
import { environment } from '../../../environments/environment';

export const authenticationGuard: CanActivateFn = () => {
  // TODO: remove this bypass when auth service is ready
  if (!environment.production && 'devAccessToken' in environment) return true;

  const authentication = inject(AuthenticationService);
  const router = inject(Router);

  if (authentication.isLoggedIn()) return true;

  return authentication.tryRestoreSession().pipe(
    map(restored => restored ? true : router.parseUrl('/login'))
  );
};
