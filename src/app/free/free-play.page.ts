import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import { NotebookMode } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { CartridgeId } from '../../core/types';
import { courseProgress } from '../../sim/course';
import { allowedFreePlay, FREE_PLAY_DISTANCES_M, WindPreset } from '../../sim/free-play';
import { ScopeId } from '../../sim/scope-model';
import { FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { ChoiceView, freePlayView } from './free-play.model';
import { BackLinkDirective } from '../services/back-link.directive';

type PickerKind = 'scope' | 'cartridge';

@Component({
  selector: 'or-free-play',
  imports: [BackLinkDirective, IonContent, IonToggle],
  template: `
    @let view = state();
    <ion-content>
      <div class="free" data-test="free-play">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="free-back">←</a>
          <div>
            <h1 class="title">{{ texts.title }}</h1>
            <div class="subtitle mono">{{ texts.subtitle }}</div>
          </div>
        </header>

        <section class="block">
          <div class="label mono">{{ texts.distanceLabel }}</div>
          <div class="distance" data-test="free-distance">{{ view.distanceText }}</div>
          <input
            class="slider"
            type="range"
            [min]="distances[0]"
            [max]="distances[distances.length - 1]"
            [step]="distanceStep"
            [value]="settings().distanceM"
            [disabled]="settings().isDistanceUnknown"
            (input)="setDistance($event)"
            [attr.aria-label]="texts.distanceSlider"
            data-test="free-distance-slider"
          />
          <ion-toggle
            [checked]="settings().isDistanceUnknown"
            [disabled]="view.unknownLock !== null"
            (ionChange)="update({ isDistanceUnknown: $event.detail.checked })"
            justify="space-between"
            data-test="free-unknown"
            >{{ texts.unknownDistance }}
            @if (view.unknownLock; as lock) {
              <span class="lock mono"> · {{ lock }}</span>
            }
          </ion-toggle>
        </section>

        <section class="block">
          <div class="label mono">{{ texts.wind }}</div>
          <div class="choices">
            @for (wind of view.winds; track wind.id) {
              <button class="choice" type="button" [class.chosen]="wind.isChosen" [disabled]="wind.lock !== null" (click)="update({ wind: wind.id })" [attr.data-test]="'free-wind-' + wind.id">
                {{ wind.label }}
                @if (wind.lock; as lock) {
                  <span class="lock mono">{{ lock }}</span>
                }
              </button>
            }
          </div>
        </section>

        <section class="block pair">
          <button class="pick" type="button" (click)="picker.set('scope')" data-test="free-scope">
            <span class="label mono">{{ texts.scope }}</span>{{ view.scopeTile }}
          </button>
          <button class="pick" type="button" (click)="picker.set('cartridge')" data-test="free-cartridge">
            <span class="label mono">{{ texts.cartridge }}</span>{{ view.cartridgeTile }}
          </button>
        </section>

        <section class="block">
          <div class="label mono">{{ texts.notebookMode }}</div>
          <div class="choices">
            @for (mode of view.modes; track mode.id) {
              <button class="choice" type="button" [class.chosen]="mode.isChosen" [disabled]="mode.lock !== null" (click)="update({ notebookMode: mode.id })" [attr.data-test]="'free-mode-' + mode.id">
                {{ mode.label }}
                @if (mode.lock; as lock) {
                  <span class="lock mono">{{ lock }}</span>
                }
              </button>
            }
          </div>
        </section>

        <section class="block">
          <ion-toggle [checked]="settings().isInstructorNear" (ionChange)="update({ isInstructorNear: $event.detail.checked })" justify="space-between" data-test="free-instructor">{{ texts.instructorNear }}</ion-toggle>
        </section>

        <div class="dock">
          <button class="start" type="button" (click)="start()" data-test="free-start">{{ texts.start }}</button>
        </div>
      </div>

      @if (picker(); as kind) {
        <div class="sheet" data-test="free-picker">
          <div class="sheet-head">
            <span class="label mono">{{ kind === 'scope' ? texts.scope : texts.cartridge }}</span>
            <button class="close mono" type="button" (click)="picker.set(null)" data-test="free-picker-close">{{ texts.done }}</button>
          </div>
          @for (item of pickerItems(); track item.id) {
            <button class="item" type="button" [class.chosen]="item.isChosen" [disabled]="item.lock !== null" (click)="choose(kind, item.id)" [attr.data-test]="'free-pick-' + item.id">
              <span class="item-name">{{ item.label }}</span>
              <span class="item-line mono">{{ item.lock ?? item.line }}</span>
            </button>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .free { display: flex; flex-direction: column; gap: var(--space-4); min-height: 100%; padding: var(--space-3) var(--gutter) 0; }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle, .label { font: 500 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .block { display: flex; flex-direction: column; gap: var(--space-2); }
    .distance { font: 700 var(--type-hero) / 44px var(--font-title); color: var(--device-text); }
    .slider { width: 100%; min-height: var(--touch-min); accent-color: var(--device-accent); }
    .choices { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .choice, .pick, .item { min-height: var(--touch-min); padding: var(--space-2) var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 500 var(--type-body) / 20px var(--font-text); text-align: left; }
    .choice.chosen, .item.chosen { border-color: var(--device-accent); color: var(--device-accent); }
    .choice:disabled, .item:disabled { color: var(--device-text-muted); }
    .lock { display: block; font-size: var(--type-min); color: var(--device-text-muted); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .pick { display: flex; flex-direction: column; gap: var(--space-1); }
    ion-toggle { min-height: var(--touch-min); }
    .dock { position: sticky; bottom: 0; margin-top: auto; padding: var(--space-3) 0 calc(var(--space-3) + env(safe-area-inset-bottom)); background: var(--device-bg); }
    .start { width: 100%; min-height: var(--button-main-height); border: 0; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; flex-direction: column; gap: var(--space-2); max-height: 70%; overflow-y: auto; padding: var(--space-3) var(--gutter) calc(var(--space-4) + env(safe-area-inset-bottom)); border-top: var(--border-width) solid var(--device-line-strong); background: var(--device-sunken); }
    .sheet-head { display: flex; align-items: center; justify-content: space-between; }
    .close { min-height: var(--touch-min); padding: 0 var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: none; color: var(--device-accent); }
    .item { display: flex; flex-direction: column; gap: var(--space-1); }
    .item-line { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class FreePlayPage {
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);
  private readonly feedback = inject(FeedbackService);

  protected readonly texts = text.screens.freePlay;
  protected readonly distances = FREE_PLAY_DISTANCES_M;
  protected readonly distanceStep = FREE_PLAY_DISTANCES_M[1] - FREE_PLAY_DISTANCES_M[0];
  protected readonly picker = signal<PickerKind | null>(null);
  private readonly unlocks = computed(() => courseProgress(this.progress.course(), this.progress.settings().isEverythingUnlocked).freePlayUnlocks);
  protected readonly settings = computed(() => allowedFreePlay(this.progress.freePlay(), this.unlocks()));
  protected readonly state = computed(() => freePlayView(this.settings(), this.unlocks()));
  protected readonly pickerItems = computed<ChoiceView<ScopeId | CartridgeId>[]>(() => (this.picker() === 'scope' ? this.state().scopes : this.state().cartridges));

  protected update(patch: Partial<{ distanceM: number; isDistanceUnknown: boolean; wind: WindPreset; notebookMode: NotebookMode; isInstructorNear: boolean; scopeId: ScopeId; cartridgeId: CartridgeId }>): void {
    this.progress.updateFreePlay(patch);
  }

  protected setDistance(event: Event): void {
    const distanceM = Number((event.target as HTMLInputElement).value);
    if (distanceM !== this.settings().distanceM) {
      this.feedback.emit('detent');
      this.update({ distanceM });
    }
  }

  protected choose(kind: PickerKind, id: ScopeId | CartridgeId): void {
    this.update(kind === 'scope' ? { scopeId: id as ScopeId } : { cartridgeId: id as CartridgeId });
    this.picker.set(null);
  }

  protected start(): void {
    void this.router.navigate(['/position', 'free']);
  }
}
