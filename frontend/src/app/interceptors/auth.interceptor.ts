import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Un 401 alors qu'on avait un jeton signifie qu'il est expiré ou invalide.
      // Sans ce traitement, l'application restait visuellement connectée et toutes
      // les requêtes échouaient en silence jusqu'au rechargement manuel de la page.
      const isAuthEndpoint = /\/auth\/(login|register)$/.test(req.url);
      if (error.status === 401 && token && !isAuthEndpoint) {
        // logout() plutôt qu'un simple nettoyage du localStorage : il remet aussi à
        // zéro currentUser$, donc l'en-tête cesse d'afficher un utilisateur connecté.
        authService.logout();
        router.navigate(['/auth/login'], {
          queryParams: { expired: '1', redirect: router.url }
        });
      }
      return throwError(() => error);
    })
  );
};
