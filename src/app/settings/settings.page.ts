import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import packageJson from '../../../package.json';
import { text } from '../../i18n';
import { backLayer } from '../services/back-stack.service';
import { FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { DRUM_SENSITIVITIES, Settings, SettingsFlag, steppedVolume, VOLUME_STEPS } from './settings.model';
import { BackLinkDirective } from '../services/back-link.directive';

interface ToggleRow {
  key: SettingsFlag;
  label: string;
  note?: string;
}

const T = text.screens.settings;
const SOUND_TOGGLES: readonly ToggleRow[] = [
  { key: 'isHapticsOn', label: T.toggles.isHapticsOn },
  { key: 'isDrumClicksOn', label: T.toggles.isDrumClicksOn },
];
const ACCESSIBILITY_TOGGLES: readonly ToggleRow[] = [
  { key: 'isTapTrigger', label: T.toggles.isTapTrigger, note: T.tapTriggerNote },
  { key: 'isTextLarge', label: T.toggles.isTextLarge },
  { key: 'isTriggerZoneLarger', label: T.toggles.isTriggerZoneLarger },
  { key: 'isMarkerDriftOff', label: T.toggles.isMarkerDriftOff },
];
const DATA_TOGGLES: readonly ToggleRow[] = [
  { key: 'isEverythingUnlocked', label: T.toggles.isEverythingUnlocked, note: T.unlockEverythingNote },
];
type HandButton = keyof typeof T.hands;

@Component({
  selector: 'or-settings',
  imports: [BackLinkDirective, IonContent, IonToggle, NgTemplateOutlet],
  template: `
    @let settings = progress.settings();
    <ion-content>
      <div class="settings" data-test="settings">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="settings-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>

        <section class="group" data-test="settings-group-sound">
          <h2 class="label mono">{{ texts.sound }}</h2>
          <label class="setting">
            <span class="setting-title">{{ texts.volume }} <b class="mono" data-test="settings-volume-value">{{ volumeStep() }} / {{ volumeSteps }}</b></span>
            <input type="range" min="0" [max]="volumeSteps" step="1" [value]="volumeStep()" (input)="setVolume($event)" [attr.aria-label]="texts.volume" data-test="settings-volume" />
          </label>
          @for (toggle of soundToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
        </section>

        <section class="group" data-test="settings-group-control">
          <h2 class="label mono">{{ texts.control }}</h2>
          <div class="setting">
            <ion-toggle [checked]="settings.isLeftHanded" (ionChange)="update('isLeftHanded', $event.detail.checked)" justify="space-between" data-test="toggle-isLeftHanded">{{ texts.toggles.isLeftHanded }}</ion-toggle>
            <div class="hands mono" aria-hidden="true" data-test="hand-scheme">
              @for (button of handOrder(); track button) {
                <span class="hand" [class.fire]="button === 'fire'">{{ texts.hands[button] }}</span>
              }
            </div>
          </div>
          <div class="setting">
            <span class="setting-title">{{ texts.drums }} <span class="note mono">{{ texts.drumsNote }}</span></span>
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
          <h2 class="label mono">{{ texts.accessibility }}</h2>
          @for (toggle of accessibilityToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
        </section>

        <section class="group" data-test="settings-group-data">
          <h2 class="label mono">{{ texts.data }}</h2>
          @for (toggle of dataToggles; track toggle.key) {
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: toggle }" />
          }
          <button class="reset" type="button" (click)="isResetAsked.set(true)" data-test="reset-progress">{{ texts.reset }}</button>
          <div class="version mono" data-test="settings-version">{{ texts.version({ version: version }) }}</div>
        </section>
      </div>

      @if (isResetAsked()) {
        <div class="confirm" role="alertdialog" data-test="reset-confirm">
          <div class="confirm-text">{{ texts.resetQuestion }}</div>
          <div class="confirm-actions">
            <button class="confirm-yes" type="button" (click)="reset()" data-test="reset-yes">{{ texts.resetYes }}</button>
            <button class="confirm-no" type="button" (click)="isResetAsked.set(false)" data-test="reset-cancel">{{ texts.resetNo }}</button>
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
  protected readonly texts = T;
  protected readonly soundToggles = SOUND_TOGGLES;
  protected readonly accessibilityToggles = ACCESSIBILITY_TOGGLES;
  protected readonly dataToggles = DATA_TOGGLES;
  protected readonly sensitivities = DRUM_SENSITIVITIES;
  protected readonly volumeSteps = VOLUME_STEPS;
  protected readonly version = packageJson.version;
  protected readonly isResetAsked = signal(false);
  private readonly resetConfirmLayer = backLayer(() => this.isResetAsked(), () => this.isResetAsked.set(false));
  protected readonly volumeStep = computed(() => Math.round(this.progress.settings().volume * VOLUME_STEPS));
  protected readonly handOrder = computed<HandButton[]>(() => (this.progress.settings().isLeftHanded ? ['fire', 'hold'] : ['hold', 'fire']));

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
