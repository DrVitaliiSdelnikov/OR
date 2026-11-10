import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import packageJson from '../../../package.json';
import { FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { DRUM_SENSITIVITIES, Settings, SettingsFlag, steppedVolume, VOLUME_STEPS } from './settings.model';

interface ToggleRow {
  key: SettingsFlag;
  label: string;
  note?: string;
}

const SOUND_TOGGLES: readonly ToggleRow[] = [
  { key: 'isHapticsOn', label: 'Вибрация' },
  { key: 'isDrumClicksOn', label: 'Щелчки барабанов' },
];
const ACCESSIBILITY_TOGGLES: readonly ToggleRow[] = [
  { key: 'isTapTrigger', label: 'Спуск тапом', note: 'очки не снижает, отмечается в журнале' },
  { key: 'isTextLarge', label: 'Крупный текст' },
  { key: 'isTriggerZoneLarger', label: 'Крупнее круг спуска' },
  { key: 'isMarkerDriftOff', label: 'Без дрейфа маркера' },
];
const DATA_TOGGLES: readonly ToggleRow[] = [
  { key: 'isEverythingUnlocked', label: 'Открыть всё', note: 'для проверки: открыть весь курс и свободную игру' },
];

@Component({
  selector: 'or-settings',
  imports: [IonContent, IonToggle, NgTemplateOutlet, RouterLink],
  template: `
    @let settings = progress.settings();
    <ion-content>
      <div class="settings" data-test="settings">
        <header class="header">
          <a class="back" routerLink="/" aria-label="Назад" data-test="settings-back">←</a>
          <h1 class="title">Настройки</h1>
        </header>

        <section class="group" data-test="settings-group-sound">
          <h2 class="label mono">Звук и вибрация</h2>
          <label class="setting">
            <span class="setting-title">Громкость <b class="mono" data-test="settings-volume-value">{{ volumeStep() }} / {{ volumeSteps }}</b></span>
            <input type="range" min="0" [max]="volumeSteps" step="1" [value]="volumeStep()" (input)="setVolume($event)" aria-label="Громкость" data-test="settings-volume" />
          </label>
          @for (toggle of soundToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
        </section>

        <section class="group" data-test="settings-group-control">
          <h2 class="label mono">Управление</h2>
          <div class="setting">
            <ion-toggle [checked]="settings.isLeftHanded" (ionChange)="update('isLeftHanded', $event.detail.checked)" justify="space-between" data-test="toggle-isLeftHanded">Левша</ion-toggle>
            <div class="hands mono" aria-hidden="true" data-test="hand-scheme">
              @for (button of handOrder(); track button) {
                <span class="hand" [class.fire]="button === 'ОГОНЬ'">{{ button }}</span>
              }
            </div>
          </div>
          <div class="setting">
            <span class="setting-title">Барабаны <span class="note mono">протяжка на один клик</span></span>
            <div class="choices">
              @for (sensitivity of sensitivities; track sensitivity.ptPerClick) {
                <button
                  class="choice"
                  type="button"
                  [class.chosen]="settings.drumPtPerClick === sensitivity.ptPerClick"
                  [attr.aria-pressed]="settings.drumPtPerClick === sensitivity.ptPerClick"
                  (click)="progress.updateSettings({ drumPtPerClick: sensitivity.ptPerClick })"
                  [attr.data-test]="'drum-sensitivity-' + sensitivity.ptPerClick"
                >
                  {{ sensitivity.label }} <span class="mono">{{ sensitivity.ptPerClick }}</span>
                </button>
              }
            </div>
          </div>
        </section>

        <section class="group" data-test="settings-group-access">
          <h2 class="label mono">Доступность</h2>
          @for (toggle of accessibilityToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
        </section>

        <section class="group" data-test="settings-group-data">
          <h2 class="label mono">Данные</h2>
          @for (toggle of dataToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
          <button class="reset" type="button" (click)="isResetAsked.set(true)" data-test="reset-progress">Сбросить прогресс</button>
          <div class="version mono" data-test="settings-version">версия {{ version }}</div>
        </section>
      </div>

      @if (isResetAsked()) {
        <div class="confirm" role="alertdialog" data-test="reset-confirm">
          <div class="confirm-text">Сбросить курс, журнал и карточки? Это не отменить</div>
          <div class="confirm-actions">
            <button class="confirm-yes" type="button" (click)="reset()" data-test="reset-yes">Сбросить</button>
            <button class="confirm-no" type="button" (click)="isResetAsked.set(false)" data-test="reset-cancel">Отмена</button>
          </div>
        </div>
      }
    </ion-content>

    <ng-template #toggleRow let-toggle>
      <div class="setting">
        <ion-toggle [checked]="isOn(toggle.key)" (ionChange)="update(toggle.key, $event.detail.checked)" justify="space-between" [attr.data-test]="'toggle-' + toggle.key">
          {{ toggle.label }}
        </ion-toggle>
        @if (toggle.note) {
          <span class="note mono">{{ toggle.note }}</span>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .settings { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .group { display: flex; flex-direction: column; gap: var(--space-1); }
    .label { margin: 0 0 var(--space-1); font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .setting { display: flex; flex-direction: column; align-items: stretch; gap: var(--space-1); padding: var(--space-2) var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 500 var(--type-body) / 1.35 var(--font-text); }
    .setting-title { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); min-height: 28px; }
    .note { font: 500 var(--type-label) / 1.3 var(--font-mono); color: var(--device-text-muted); }
    ion-toggle { min-height: var(--touch-min); }
    input[type='range'] { width: 100%; min-height: var(--touch-min); accent-color: var(--device-accent); }
    .hands { display: flex; gap: var(--space-2); }
    .hand { display: grid; place-items: center; min-width: 72px; min-height: 32px; border: var(--border-width) solid var(--device-line-strong); border-radius: 16px; font: 700 var(--type-label) / 1 var(--font-mono); letter-spacing: var(--tracking-label); }
    .hand.fire { border-color: var(--device-error); color: var(--device-error); }
    .choices { display: flex; gap: var(--space-2); }
    .choice { flex: 1; min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 500 var(--type-body) / 1.2 var(--font-text); }
    .choice.chosen { border-color: var(--device-accent); color: var(--device-accent); }
    .reset { min-height: var(--touch-min); border: var(--border-width) solid var(--device-error); border-radius: var(--radius-device); background: transparent; color: var(--device-error); font: 700 var(--type-label) / 1.2 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .version { padding: var(--space-2) var(--space-3); font: 500 var(--type-label) / 1.3 var(--font-mono); color: var(--device-text-muted); }
    .confirm { position: fixed; left: var(--gutter); right: var(--gutter); bottom: calc(var(--space-6) + env(safe-area-inset-bottom)); z-index: 10; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 500 var(--type-body) / 1.35 var(--font-text); }
    .confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .confirm-yes, .confirm-no { min-height: var(--touch-min); border-radius: var(--radius-device); font: 700 var(--type-label) / 1.2 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .confirm-yes { border: 0; background: var(--device-error); color: var(--device-text); }
    .confirm-no { border: var(--border-width) solid var(--device-line); background: transparent; color: var(--device-text); }
  `,
})
export class SettingsPage {
  protected readonly progress = inject(ProgressStore);
  private readonly feedback = inject(FeedbackService);
  protected readonly soundToggles = SOUND_TOGGLES;
  protected readonly accessibilityToggles = ACCESSIBILITY_TOGGLES;
  protected readonly dataToggles = DATA_TOGGLES;
  protected readonly sensitivities = DRUM_SENSITIVITIES;
  protected readonly volumeSteps = VOLUME_STEPS;
  protected readonly version = packageJson.version;
  protected readonly isResetAsked = signal(false);
  protected readonly volumeStep = computed(() => Math.round(this.progress.settings().volume * VOLUME_STEPS));
  protected readonly handOrder = computed(() => (this.progress.settings().isLeftHanded ? ['ОГОНЬ', 'ДЕРЖАТЬ'] : ['ДЕРЖАТЬ', 'ОГОНЬ']));

  protected isOn(key: SettingsFlag): boolean {
    return this.progress.settings()[key];
  }

  protected update(key: SettingsFlag, isOn: boolean): void {
    this.progress.updateSettings({ [key]: isOn } as Partial<Settings>);
  }

  protected setVolume(event: Event): void {
    this.progress.updateSettings({ volume: steppedVolume(Number((event.target as HTMLInputElement).value) / VOLUME_STEPS) });
    this.feedback.emit('detent');
  }

  protected reset(): void {
    this.progress.resetProgress();
    this.isResetAsked.set(false);
  }
}
