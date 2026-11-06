import { Component, effect, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ProgressStore } from './services/progress.store';

@Component({
  selector: 'or-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class App {
  private readonly progress = inject(ProgressStore);

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.progress.settings().theme;
    });
  }
}
