import { afterNextRender, Component, computed, ElementRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { FeedbackService } from '../services/feedback.service';
import { factorContributions, NotebookFactor, NotebookStepId, tabs } from '../../sim/notebook';
import { PositionSession } from '../position/position-session';
import { CalcSheetComponent } from './calc-sheet.component';
import { hubRows, hubSteps, modeBadge, STEP_FORMULAS, STEP_TITLES } from './calc-sheet.model';
import { ConditionsTabComponent, StationView } from './conditions-tab.component';
import { DistanceTabComponent } from './distance-tab.component';
import { DopeTabComponent } from './dope-tab.component';
import { FormulaLine, FormulasSheetComponent } from './formulas-sheet.component';
import { DopeNote, dopeNoteTexts } from '../review/review.model';
import { ManualHubComponent } from './manual-hub.component';
import {
  CARTRIDGE_LETTERS,
  clockText,
  contributionText,
  correctionLine,
  dopeTable,
  FACTOR_NAMES,
  factorDetail,
  LOCKED_TABS,
  NOTEBOOK_TABS,
  NotebookTab,
  rangeClockText,
  shotStrip,
  totalLine,
} from './notebook.model';
import { FactorRow, TotalTabComponent } from './total-tab.component';
import { WindInput, WindTabComponent } from './wind-tab.component';

const SWIPE_CLOSE_PT = 80;
const LOCKED_NOTICE_MS = 1800;
const FACTOR_ORDER: readonly NotebookFactor[] = ['dope', 'conditions', 'wind', 'lead'];

@Component({
  selector: 'or-notebook-sheet',
  imports: [TotalTabComponent, ManualHubComponent, DistanceTabComponent, ConditionsTabComponent, WindTabComponent, DopeTabComponent, CalcSheetComponent, FormulasSheetComponent],
  template: `
    @let state = view();
    @if (calcStep(); as step) {
      <or-calc-sheet [session]="session()" [revision]="revision()" [step]="step" (back)="closeStep()" (changed)="changed.emit()" (formulas)="openFormulas()" />
    } @else {
    <section class="sheet" [style.transform]="'translateY(' + dragOffsetPt() + 'px)'" role="dialog" aria-label="Блокнот" data-test="notebook-sheet">
      <header class="frame" (pointerdown)="dragStart($event)" (pointermove)="dragMove($event)" (pointerup)="dragEnd()" (pointercancel)="dragEnd()">
        <button class="handle" type="button" (click)="close.emit()" aria-label="Закрыть блокнот" data-test="sheet-handle"><span class="grip"></span></button>
        <nav class="tabs" data-test="notebook-tabs">
          @for (item of tabItems; track item.id) {
            <button class="tab" type="button" [class.active]="tab() === item.id" (click)="selectTab(item.id)" [attr.aria-pressed]="tab() === item.id" [attr.data-test]="'tab-' + item.id" [attr.data-hint]="'tab-' + item.id">
              {{ item.label }}
              @if (!state.filled[item.id]) {
                <span class="dot" [attr.data-test]="'dot-' + item.id" aria-label="не заполнено"></span>
              }
            </button>
          }
          @for (label of lockedTabs; track label) {
            <button class="tab locked" type="button" (click)="showLocked()" [attr.data-test]="'locked-' + label">
              <svg class="lock" viewBox="0 0 12 14" aria-hidden="true"><rect x="1.5" y="6" width="9" height="7" rx="1" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" /></svg>
              {{ label }}
            </button>
          }
        </nav>
      </header>

      <div class="paper" #paper>
        @if (lockedNotice()) {
          <div class="locked-notice mono" data-test="locked-notice">Откроется в следующем этапе</div>
        }
        @switch (tab()) {
          @case ('total') {
            @if (state.isManual) {
              <or-manual-hub [rows]="state.hubRows" [badge]="state.badge" [formulasLabel]="state.formulasLabel" (openStep)="openStep($event)" (formulas)="openFormulas()" />
            } @else {
              <or-total-tab [rows]="state.factorRows" (toggle)="toggleFactor($event)" />
            }
          }
          @case ('distance') {
            <or-distance-tab [knownText]="state.knownDistance" [gongMil]="state.gongMil" [resultText]="state.millingResult" [isManual]="state.isManual" (measure)="measureRange($event)" />
          }
          @case ('conditions') {
            <or-conditions-tab [reading]="state.station" [correctionText]="state.conditionsCorrection" [stepLinkText]="state.isManual ? 'к расчёту: шаг Атмосфера →' : null" (measure)="measure.emit($event)" (toStep)="openStep('atmosphere')" />
          }
          @case ('wind') {
            <or-wind-tab [wind]="state.wind" [caption]="state.windCaption" [stationText]="state.stationWind" [correctionText]="state.windCorrection" [stepLinkText]="state.isManual ? 'к расчёту: шаг Ветер →' : null" [showShares]="state.isEasy" (windChange)="enterWind($event)" (toStep)="openStep(state.hasZones ? 'zones' : 'wind')" />
          }
          @case ('dope') {
            <or-dope-tab [heading]="state.dopeHeading" [rows]="state.dopeRows" />
          }
        }
      </div>

      <footer class="footer">
        <div class="strip mono" data-test="shot-strip">
          @for (shot of state.strip; track $index) {
            <span>{{ shot }}</span>
          } @empty {
            <span class="muted">выстрелов ещё нет</span>
          }
        </div>
        <div class="total mono" data-test="sheet-total">{{ state.totalLine }}</div>
        <button class="enter" type="button" [disabled]="state.isTotalEmpty" (click)="enter.emit()" data-test="enter-turrets" data-hint="enter-turrets">Внести на барабаны</button>
      </footer>
    </section>
    }
    @if (isFormulasOpen()) {
      <or-formulas-sheet [lines]="state.formulaLines" [needsConfirm]="state.needsReferenceConfirm" (confirm)="confirmReference()" (close)="isFormulasOpen.set(false)" />
    }
  `,
  styles: `
    :host { display: block; }
    .sheet { display: flex; flex-direction: column; height: 100%; border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--device-surface); box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.45); transition: transform var(--motion-paper); }
    .frame { padding: 0 var(--space-2); touch-action: none; }
    .handle { display: grid; place-items: center; width: 100%; height: var(--touch-min); padding: 0; border: none; background: none; }
    .grip { width: 36px; height: 4px; border-radius: 2px; background: var(--device-line-muted); }
    .tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; }
    .tab { position: relative; flex: none; min-height: var(--touch-min); padding: 0 var(--space-2); border: var(--border-width) solid var(--device-line); border-bottom: none; border-radius: 8px 8px 0 0; background: var(--device-sunken); color: var(--device-text-muted); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .tab.active { border-color: var(--paper-bg); background: var(--paper-bg); color: var(--paper-ink); }
    .tab.locked { display: inline-flex; align-items: center; gap: 4px; border-style: dashed; background: transparent; }
    .lock { width: 10px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.4; }
    .dot { position: absolute; top: 6px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--device-accent); }
    .paper { position: relative; flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-3) var(--gutter); background-color: var(--paper-bg); background-image: linear-gradient(var(--paper-grid) 1px, transparent 1px), linear-gradient(90deg, var(--paper-grid) 1px, transparent 1px); background-size: 16px 16px; background-position: -1px -1px; }
    .locked-notice { margin-bottom: var(--space-2); padding: 4px 8px; border: 1.5px dashed var(--paper-graphite); border-radius: 4px; color: var(--paper-graphite); font: 500 var(--type-label) / 16px var(--font-mono); }
    .footer { display: flex; flex-direction: column; gap: 6px; padding: var(--space-2) var(--gutter) var(--space-3); border-top: 1px solid var(--paper-grid); background: var(--paper-bg); }
    .strip { display: flex; gap: var(--space-2); overflow: hidden; white-space: nowrap; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .muted { opacity: 0.8; }
    .total { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
    .enter { min-height: 52px; border: none; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-body) / 20px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .enter:disabled { opacity: 0.45; }
  `,
})
export class NotebookSheetComponent {
  private readonly feedback = inject(FeedbackService);
  private readonly openingClick = afterNextRender(() => this.feedback.emit('sheet'));
  readonly session = input.required<PositionSession>();
  readonly revision = input(0);
  readonly dopeNotes = input<DopeNote[]>([]);
  readonly tab = model<NotebookTab>('total');
  readonly measure = output<number>();
  readonly changed = output<void>();
  readonly enter = output<void>();
  readonly close = output<void>();
  readonly expandedChange = output<boolean>();
  readonly calcStepChange = output<NotebookStepId | null>();

  private readonly paper = viewChild<ElementRef<HTMLElement>>('paper');

  protected readonly tabItems = NOTEBOOK_TABS;
  protected readonly lockedTabs = LOCKED_TABS;
  protected readonly lockedNotice = signal(false);
  protected readonly dragOffsetPt = signal(0);
  protected readonly calcStep = signal<NotebookStepId | null>(null);
  protected readonly isFormulasOpen = signal(false);
  protected readonly view = computed(() => {
    this.revision();
    const session = this.session();
    const notebook = session.notebook;
    const scope = notebook.context.scope;
    const total = session.total;
    const factors = factorContributions(notebook);
    const filled = tabs(notebook);
    const station = notebook.readings.station;
    const wind = notebook.readings.wind;
    const stationTime = station ? rangeClockText(station.timeS - session.scenario.startTimeS) : '';
    const target = session.target;
    const stationView: StationView | null = station && {
      temperature: `${station.temperatureC.toFixed(0)} C`,
      pressure: `${station.pressureHpa.toFixed(0)} гПа`,
      humidity: `${Math.round(station.relativeHumidity * 100)} %`,
      wind: `${station.windSpeedMps.toFixed(1)} м/с`,
      time: stationTime,
      isShort: station.isShort,
    };
    const factorRows: FactorRow[] = FACTOR_ORDER.filter(factor => factor !== 'lead' || notebook.context.target.movement !== undefined).map(factor => ({
      factor,
      name: FACTOR_NAMES[factor],
      isOn: notebook.factorsOn[factor],
      contribution: contributionText(factor, factors[factor]),
      detail: factorDetail(notebook, factor),
    }));
    const reticleMil = notebook.readings.reticleMil;
    const isManual = notebook.mode !== 'auto';
    const formulaLines: FormulaLine[] = hubSteps(notebook).map(step => ({ title: STEP_TITLES[step], formula: STEP_FORMULAS[step] }));
    return {
      isManual,
      isEasy: notebook.mode === 'manual-easy',
      hasZones: notebook.context.hasZones,
      hubRows: isManual ? hubRows(notebook) : [],
      badge: modeBadge(notebook.mode),
      formulasLabel: notebook.mode === 'manual-hard' && !notebook.hasOpenedReference ? 'Формулы −30' : 'Формулы',
      formulaLines,
      needsReferenceConfirm: notebook.mode === 'manual-hard' && !notebook.hasOpenedReference,
      filled: { total: filled.total, distance: filled.distance, conditions: filled.conditions, wind: filled.wind, dope: filled.dope } as Record<NotebookTab, boolean>,
      factorRows,
      knownDistance: notebook.context.target.distanceM === null ? null : `Дистанция ${notebook.context.target.distanceM} м · задана упражнением`,
      gongMil: (target.diameterM * 1000) / target.distanceM,
      millingResult:
        reticleMil === null || notebook.distanceM === null
          ? null
          : `Д = ${notebook.context.target.sizeM} × 1000 / ${reticleMil.toFixed(2)} = ${Math.round(notebook.distanceM)} м`,
      station: stationView,
      conditionsCorrection: correctionLine('conditions', factors.conditions),
      wind: wind as WindInput | null,
      windCaption: wind ? `ветер ${wind.speedMps.toFixed(1)} м/с с ${clockText(wind.clock)}` : 'тяни стрелку к часу, откуда дует',
      stationWind: station ? `станция: ${station.windSpeedMps.toFixed(1)} м/с · ${stationTime}` : 'станция: нет замера',
      windCorrection: correctionLine('wind', factors.wind),
      dopeHeading: `Карточка патрона ${CARTRIDGE_LETTERS[notebook.context.card.cartridgeId]} · ноль 100 м · эталон +15 C / 1013 гПа`,
      dopeRows: dopeTable(notebook.context.card, notebook.distanceM, dopeNoteTexts(this.dopeNotes(), notebook.context.card)),
      strip: shotStrip(session.records),
      totalLine: totalLine(scope, total),
      isTotalEmpty: total.isEmpty,
    };
  });

  private dragStartY: number | null = null;
  private lockedTimer: ReturnType<typeof setTimeout> | null = null;

  protected selectTab(tab: NotebookTab): void {
    this.tab.set(tab);
    this.paper()?.nativeElement.scrollTo({ top: 0 });
  }

  protected toggleFactor(factor: NotebookFactor): void {
    this.session().toggleFactor(factor);
    this.changed.emit();
  }

  protected enterWind(wind: WindInput): void {
    this.session().enterWind(wind.speedMps, wind.clock);
    this.changed.emit();
  }

  protected measureRange(sizeMil: number): void {
    this.session().measureRange(sizeMil);
    this.changed.emit();
    if (this.session().notebook.mode !== 'auto') {
      this.openStep('distance');
    }
  }

  protected openStep(step: NotebookStepId): void {
    this.calcStep.set(step);
    this.calcStepChange.emit(step);
    this.expandedChange.emit(true);
  }

  protected closeStep(): void {
    this.calcStep.set(null);
    this.calcStepChange.emit(null);
    this.tab.set('total');
    this.expandedChange.emit(false);
  }

  protected openFormulas(): void {
    this.isFormulasOpen.set(true);
  }

  protected confirmReference(): void {
    this.session().openReference();
    this.changed.emit();
  }

  protected showLocked(): void {
    this.lockedNotice.set(true);
    if (this.lockedTimer) {
      clearTimeout(this.lockedTimer);
    }
    this.lockedTimer = setTimeout(() => this.lockedNotice.set(false), LOCKED_NOTICE_MS);
  }

  protected dragStart(event: PointerEvent): void {
    if ((event.target as Element).closest('.tabs')) {
      return;
    }
    this.dragStartY = event.clientY;
  }

  protected dragMove(event: PointerEvent): void {
    if (this.dragStartY === null) {
      return;
    }
    const element = event.currentTarget as Element;
    if (!element.hasPointerCapture?.(event.pointerId)) {
      element.setPointerCapture?.(event.pointerId);
    }
    this.dragOffsetPt.set(Math.max(0, event.clientY - this.dragStartY));
  }

  protected dragEnd(): void {
    if (this.dragStartY === null) {
      return;
    }
    const shouldClose = this.dragOffsetPt() > SWIPE_CLOSE_PT;
    this.dragStartY = null;
    this.dragOffsetPt.set(0);
    if (shouldClose) {
      this.close.emit();
    }
  }
}
