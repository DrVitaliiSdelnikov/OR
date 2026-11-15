import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { DragModel, TwistDirection } from '../../core/types';
import { Quantity } from '../../core/units';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import { BcAtmosphere, PresetCode, PROFILE_PRESETS, profileFromPreset, RifleProfile } from '../../sim/rifle-profile';
import { MRAD_PER_MOA, ReticleKind, ScopeUnits } from '../../sim/scope-model';
import { backLayer, BackStackService } from '../services/back-stack.service';
import { ProgressStore } from '../services/progress.store';
import { fieldMessages, FormField, formOf, isDirty, isSaveAllowed, profileOf, RifleForm, stabilityMessage } from './rifle-form.model';

type NumberField = { [Field in FormField]: RifleForm[Field] extends number | null ? Field : never }[FormField];

interface NumberInput {
  field: NumberField;
  label: string;
  unit: string;
}

interface Choice<Value> {
  value: Value;
  label: string;
}

const T = text.rifle;
const CLICK_VALUES: Record<ScopeUnits, readonly number[]> = { MIL: [0.05, 0.1, 0.2], MOA: [0.125, 0.25, 0.5] };
const DEFAULT_CLICK: Record<ScopeUnits, number> = { MIL: 0.1, MOA: 0.25 };
const DECIMAL_COMMA = /,/g;
const TYPOGRAPHIC_MINUS = /−/g;
const COLD_BORE_DIGITS = 2;
let newProfileCounter = 0;

@Component({
  selector: 'or-rifle-edit',
  imports: [IonContent, NgTemplateOutlet],
  template: `
    @let form = draft();
    @let messages = errors();
    <ion-content>
      <div class="page" data-test="rifle-editor">
        <header class="header">
          <button class="back" type="button" (click)="back()" [attr.aria-label]="texts.back" data-test="rifle-edit-back">←</button>
          <h1 class="title">{{ form.name || texts.title }}</h1>
        </header>

        <section class="sheet paper">
          <h2 class="label mono">{{ texts.sections.rifle }}</h2>
          <label class="field">
            <span class="field-label">{{ texts.fields.name }}</span>
            <input class="input" type="text" maxlength="60" [value]="form.name" (input)="setName($event)" data-test="field-name" />
            @if (messages.name) {
              <span class="error mono" data-test="error-name">{{ messages.name }}</span>
            }
          </label>
          @for (item of rifleInputs(); track item.field) {
            <ng-container *ngTemplateOutlet="numberInput; context: { $implicit: item }" />
          }
          <div class="field">
            <span class="field-label">{{ texts.fields.twistDirection }}</span>
            <div class="choices">
              @for (choice of twistDirections; track choice.value) {
                <button class="choice" type="button" [class.chosen]="form.twistDirection === choice.value" (click)="set('twistDirection', choice.value)" [attr.data-test]="'twist-' + choice.value">{{ choice.label }}</button>
              }
            </div>
          </div>
        </section>

        <section class="sheet paper">
          <h2 class="label mono">{{ texts.sections.cartridge }}</h2>
          <div class="field">
            <span class="field-label">{{ texts.fields.dragModel }}</span>
            <div class="choices">
              @for (model of dragModels; track model) {
                <button class="choice" type="button" [class.chosen]="form.dragModel === model" (click)="set('dragModel', model)" [attr.data-test]="'drag-' + model">{{ model }}</button>
              }
            </div>
          </div>
          @for (item of cartridgeInputs(); track item.field) {
            <ng-container *ngTemplateOutlet="numberInput; context: { $implicit: item }" />
          }
        </section>

        <section class="sheet paper">
          <h2 class="label mono">{{ texts.sections.scope }}</h2>
          <div class="field">
            <span class="field-label">{{ texts.fields.scopeUnits }}</span>
            <div class="choices">
              @for (units of scopeUnits; track units) {
                <button class="choice" type="button" [class.chosen]="form.scopeUnits === units" (click)="setScopeUnits(units)" [attr.data-test]="'units-' + units">{{ units }}</button>
              }
            </div>
          </div>
          <div class="field">
            <span class="field-label">{{ texts.fields.clickValue }}</span>
            <div class="choices">
              @for (value of clickValues(); track value) {
                <button class="choice mono" type="button" [class.chosen]="form.clickValue === value" (click)="set('clickValue', value)" [attr.data-test]="'click-' + value">{{ decimalText(value) }}</button>
              }
            </div>
          </div>
          <div class="field">
            <span class="field-label">{{ texts.fields.focalPlane }}</span>
            <div class="choices">
              <button class="choice" type="button" [class.chosen]="form.isFirstFocalPlane" (click)="set('isFirstFocalPlane', true)" data-test="plane-first">{{ texts.focalPlanes.first }}</button>
              <button class="choice" type="button" [class.chosen]="!form.isFirstFocalPlane" (click)="set('isFirstFocalPlane', false)" data-test="plane-second">{{ texts.focalPlanes.second }}</button>
            </div>
          </div>
          @for (item of scopeInputs; track item.field) {
            <ng-container *ngTemplateOutlet="numberInput; context: { $implicit: item }" />
          }
          <div class="field">
            <span class="field-label">{{ texts.fields.reticle }}</span>
            <div class="choices">
              @for (choice of reticles; track choice.value) {
                <button class="choice" type="button" [class.chosen]="form.reticle === choice.value" (click)="set('reticle', choice.value)" [attr.data-test]="'reticle-' + choice.value">{{ choice.label }}</button>
              }
            </div>
          </div>
        </section>

        <details class="sheet paper" data-test="rifle-advanced">
          <summary class="label mono">{{ texts.sections.advanced }}</summary>
          @for (item of advancedInputs(); track item.field) {
            <ng-container *ngTemplateOutlet="numberInput; context: { $implicit: item }" />
          }
          <div class="field">
            <span class="field-label">{{ texts.fields.bcAtmosphere }}</span>
            <div class="choices">
              @for (choice of bcAtmospheres; track choice.value) {
                <button class="choice" type="button" [class.chosen]="form.bcAtmosphere === choice.value" (click)="set('bcAtmosphere', choice.value)" [attr.data-test]="'bc-' + choice.value">{{ choice.label }}</button>
              }
            </div>
          </div>
        </details>

        @if (stability()) {
          <div class="warning" data-test="rifle-stability">{{ stability() }}</div>
        }
        <div class="footer">
          <button class="save" type="button" [disabled]="!canSave()" (click)="save()" data-test="rifle-save">{{ texts.save }}</button>
          <button class="cancel" type="button" (click)="back()" data-test="rifle-cancel">{{ texts.cancel }}</button>
        </div>
      </div>

      @if (isLeaveAsked()) {
        <div class="confirm" role="alertdialog" data-test="rifle-leave-confirm">
          <div>{{ texts.leaveQuestion }}</div>
          <div class="confirm-actions">
            <button class="confirm-yes" type="button" (click)="leave()" data-test="rifle-leave-yes">{{ texts.leaveYes }}</button>
            <button class="confirm-no" type="button" (click)="isLeaveAsked.set(false)" data-test="rifle-leave-cancel">{{ texts.cancel }}</button>
          </div>
        </div>
      }
    </ion-content>

    <ng-template #numberInput let-item>
      <label class="field">
        <span class="field-label">{{ item.label }}</span>
        <span class="input-row">
          <input class="input mono" type="text" inputmode="decimal" [value]="rawText(item.field)" (input)="setNumber(item.field, $event)" [attr.data-test]="'field-' + item.field" />
          <span class="unit mono">{{ item.unit }}</span>
        </span>
        @if (messageOf(item.field); as message) {
          <span class="error mono" [attr.data-test]="'error-' + item.field">{{ message }}</span>
        }
      </label>
    </ng-template>
  `,
  styleUrl: './rifle.styles.css',
})
export class RifleEditPage {
  private readonly progress = inject(ProgressStore);
  private readonly backStack = inject(BackStackService);
  readonly profileId = input<string>();
  readonly presetCode = input<string>();
  protected readonly texts = T;
  protected readonly dragModels: readonly DragModel[] = ['G7', 'G1'];
  protected readonly scopeUnits: readonly ScopeUnits[] = ['MIL', 'MOA'];
  protected readonly twistDirections: readonly Choice<TwistDirection>[] = (['right', 'left'] as const).map(value => ({ value, label: T.twistDirections[value] }));
  protected readonly bcAtmospheres: readonly Choice<BcAtmosphere>[] = (['asm', 'icao'] as const).map(value => ({ value, label: T.bcAtmospheres[value] }));
  protected readonly reticles: readonly Choice<ReticleKind>[] = (['tree', 'mil-dot', 'moa-grid'] as const).map(value => ({ value, label: T.reticles[value] }));
  protected readonly scopeInputs: readonly NumberInput[] = [
    { field: 'magnificationMin', label: T.fields.magnificationMin, unit: '×' },
    { field: 'magnificationMax', label: T.fields.magnificationMax, unit: '×' },
  ];
  protected readonly isLeaveAsked = signal(false);
  private isLeaveConfirmed = false;
  private readonly system = computed(() => this.progress.settings().unitSystem);
  private readonly base = computed<RifleProfile | null>(() => {
    const code = this.presetCode();
    if (code) {
      const preset = PROFILE_PRESETS.find(candidate => candidate.code === code);
      return preset ? profileFromPreset(preset.code as PresetCode, newProfileId(), T.newProfileName({ presetName: preset.name })) : null;
    }
    return this.progress.profiles().find(profile => profile.id === this.profileId()) ?? null;
  });
  private readonly rawTexts = signal<Partial<Record<NumberField, string>>>({});
  private readonly edits = signal<Partial<RifleForm>>({});
  protected readonly draft = computed<RifleForm>(() => {
    const base = this.base();
    return base ? { ...formOf(base, this.system()), ...this.edits() } : ({} as RifleForm);
  });
  private readonly draftProfile = computed(() => {
    const base = this.base();
    return base ? profileOf(this.draft(), base, this.system()) : null;
  });
  protected readonly errors = computed(() => {
    const profile = this.draftProfile();
    return profile ? fieldMessages(profile, this.system()) : {};
  });
  protected readonly stability = computed(() => {
    const profile = this.draftProfile();
    return profile ? stabilityMessage(profile) : null;
  });
  protected readonly canSave = computed(() => {
    const profile = this.draftProfile();
    return profile !== null && isSaveAllowed(profile);
  });
  protected readonly clickValues = computed(() => CLICK_VALUES[this.draft().scopeUnits]);
  protected readonly rifleInputs = computed<NumberInput[]>(() => [
    { field: 'zero', label: T.fields.zero, unit: this.unit('distance') },
    { field: 'sightHeight', label: T.fields.sightHeight, unit: this.unit('sightHeight') },
    { field: 'twistInches', label: T.fields.twistInches, unit: '″' },
    { field: 'groupMoa', label: T.fields.groupMoa, unit: 'MOA' },
  ]);
  protected readonly cartridgeInputs = computed<NumberInput[]>(() => [
    { field: 'muzzleVelocity', label: T.fields.muzzleVelocity, unit: this.unit('muzzleVelocity') },
    { field: 'ballisticCoefficient', label: T.fields.ballisticCoefficient, unit: this.draft().dragModel },
    { field: 'bulletMass', label: T.fields.bulletMass, unit: this.unit('bulletMass') },
    { field: 'caliberInches', label: T.fields.caliberInches, unit: '″' },
    { field: 'bulletLength', label: T.fields.bulletLength, unit: this.unit('bulletLength') },
  ]);
  protected readonly advancedInputs = computed<NumberInput[]>(() => [
    { field: 'muzzleVelocitySd', label: T.fields.muzzleVelocitySd, unit: this.unit('muzzleVelocity') },
    { field: 'coldBoreUp', label: T.fields.coldBoreUp, unit: this.draft().scopeUnits },
    { field: 'coldBoreRight', label: T.fields.coldBoreRight, unit: this.draft().scopeUnits },
  ]);
  private readonly leaveConfirmLayer = backLayer(() => this.isLeaveAsked(), () => this.isLeaveAsked.set(false));

  canLeave(): boolean {
    const base = this.base();
    if (this.isLeaveConfirmed || !base || !this.isChanged()) {
      return true;
    }
    this.isLeaveAsked.set(true);
    return false;
  }

  protected rawText(field: NumberField): string {
    const raw = this.rawTexts()[field];
    if (raw !== undefined) {
      return raw;
    }
    const value = this.draft()[field];
    return value === null ? '' : decimal(value);
  }

  protected messageOf(field: FormField): string | undefined {
    return this.errors()[field];
  }

  protected decimalText(value: number): string {
    return decimal(value);
  }

  protected setName(event: Event): void {
    this.set('name', (event.target as HTMLInputElement).value);
  }

  protected setNumber(field: NumberField, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.rawTexts.update(texts => ({ ...texts, [field]: raw }));
    const trimmed = raw.trim();
    const isOptional = field === 'coldBoreUp' || field === 'coldBoreRight';
    const value = trimmed === '' && isOptional ? null : trimmed === '' ? Number.NaN : Number(trimmed.replace(DECIMAL_COMMA, '.').replace(TYPOGRAPHIC_MINUS, '-'));
    this.edits.update(edits => ({ ...edits, [field]: value }));
  }

  protected set<Field extends FormField>(field: Field, value: RifleForm[Field]): void {
    this.edits.update(edits => ({ ...edits, [field]: value }));
  }

  protected setScopeUnits(units: ScopeUnits): void {
    const form = this.draft();
    if (form.scopeUnits === units) {
      return;
    }
    const convert = (value: number | null): number | null =>
      value === null ? null : Number((units === 'MOA' ? value / MRAD_PER_MOA : value * MRAD_PER_MOA).toFixed(COLD_BORE_DIGITS));
    this.rawTexts.update(({ coldBoreUp, coldBoreRight, ...others }) => others);
    this.edits.update(edits => ({ ...edits, scopeUnits: units, clickValue: DEFAULT_CLICK[units], coldBoreUp: convert(form.coldBoreUp), coldBoreRight: convert(form.coldBoreRight) }));
  }

  protected save(): void {
    const profile = this.draftProfile();
    if (!profile || !this.progress.saveProfile(profile)) {
      return;
    }
    this.isLeaveConfirmed = true;
    this.backStack.backFromPage('/rifle');
  }

  protected back(): void {
    if (this.canLeave()) {
      this.leave();
    }
  }

  protected leave(): void {
    this.isLeaveConfirmed = true;
    this.isLeaveAsked.set(false);
    this.backStack.backFromPage('/rifle');
  }

  private isChanged(): boolean {
    const base = this.base()!;
    return this.presetCode() !== undefined || isDirty(this.draft(), base, this.system());
  }

  private unit(quantity: Quantity): string {
    return text.units.unitLabel(quantity, this.system());
  }
}

function newProfileId(): string {
  newProfileCounter += 1;
  return `profile-${Date.now().toString(36)}-${newProfileCounter}`;
}
