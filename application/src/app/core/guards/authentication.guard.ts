import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthenticationService } from '../services/authentication/authentication.service';

export const authenticationGuard: CanActivateFn = () => {
  const authentication = inject(AuthenticationService);
  const router = inject(Router);

  if (authentication.isLoggedIn()) return true;

  return authentication.tryRestoreSession().pipe(
    map(restored => restored ? true : router.parseUrl('/login'))
  );
};
