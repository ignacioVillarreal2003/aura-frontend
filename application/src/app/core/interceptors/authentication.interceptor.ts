import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthenticationService } from '../services/authentication/authentication.service';

let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<boolean>(false);

const AUTH_SKIP_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  const withToken = (r: typeof req): typeof req => {
    const token = auth.getToken();
    return token
      ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : r;
  };

  return next(withToken(req)).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        AUTH_SKIP_URLS.some(url => req.url.includes(url))
      ) {
        return throwError(() => err);
      }

      if (isRefreshing) {
        return refreshDone$.pipe(
          filter(done => done),
          take(1),
          switchMap(() => next(withToken(req))),
        );
      }

      isRefreshing = true;
      refreshDone$.next(false);

      return auth.refreshSession().pipe(
        switchMap(() => {
          isRefreshing = false;
          refreshDone$.next(true);
          return next(withToken(req));
        }),
        catchError((refreshErr) => {
          isRefreshing = false;
          refreshDone$.next(false);
          auth.logout().subscribe();
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
