import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app.routes';
import { isOfflineCacheEnabled, reloadIfNewVersion } from './services/offline.model';
import { ProgressStore } from './services/progress.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ mode: 'ios', animated: true, hardwareBackButton: true }),
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideAppInitializer(() => inject(ProgressStore).load()),
    provideAppInitializer(() => {
      const updates = inject(SwUpdate);
      if (updates.isEnabled) {
        void reloadIfNewVersion(() => updates.checkForUpdate(), () => document.location.reload());
      }
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: isOfflineCacheEnabled({ isDevMode: isDevMode(), isNativePlatform: Capacitor.isNativePlatform() }),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
