import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { authInterceptor } from './interceptors/auth.interceptor';
import { SettingsService } from './services/settings.service';
import { BrandService } from './services/brand.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled'
    })),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(MatSnackBarModule, MatDialogModule),
    {
      provide: APP_INITIALIZER,
      useFactory: (brand: BrandService, settings: SettingsService) => () => {
        brand.load();
        settings.load();
      },
      multi: true,
      deps: [BrandService, SettingsService]
    }
  ]
};
