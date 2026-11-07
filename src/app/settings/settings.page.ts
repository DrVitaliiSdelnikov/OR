import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import { ProgressStore, Settings } from '../services/progress.store';

type ToggleKey = keyof Settings;

@Component({
  selector: 'or-settings',
  imports: [IonContent, IonToggle, RouterLink],
  template: `
    <ion-content>
      <div class="screen">
        <div class="top-bar">
          <a class="button" routerLink="/" aria-label="Назад" data-test="settings-back">←</a>
          <h1>Настройки</h1>
        </div>
        <div class="card toggles">
          @for (toggle of toggles; track toggle.key) {
            <ion-toggle
              [checked]="progress.settings()[toggle.key]"
              (ionChange)="update(toggle.key, $event.detail.checked)"
              [attr.data-test]="'toggle-' + toggle.key"
              justify="space-between"
            >{{ toggle.label }}</ion-toggle>
          }
        </div>
        <button class="button" (click)="progress.resetProgress()" data-test="reset-progress">Сбросить прогресс</button>
      </div>
    </ion-content>
  `,
  styles: `
    a { text-decoration: none; }
    .toggles { display: flex; flex-direction: column; gap: 4px; }
    ion-toggle { min-height: 48px; }
  `,
})
export class SettingsPage {
  protected readonly progress = inject(ProgressStore);
  protected readonly toggles: { key: ToggleKey; label: string }[] = [
    { key: 'isSoundOn', label: 'Звук' },
    { key: 'isHapticsOn', label: 'Вибрация' },
    { key: 'isTriggerZoneLarger', label: 'Более крупный круг спуска' },
    { key: 'isMarkerDriftOff', label: 'Без дрейфа маркера' },
    { key: 'isEverythingUnlocked', label: 'Открыть все задачи' },
  ];

  protected update(key: ToggleKey, isChecked: boolean): void {
    this.progress.updateSettings({ [key]: isChecked });
  }
}
