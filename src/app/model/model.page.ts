import { Component, computed, inject, resource, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { BallisticsEngine } from '../../core/engine';
import { comparedRows, comparisonSummary, REFERENCE_TABLES } from '../../core/reference-check';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { assumptionLines, comparisonTableView, formulaRows, referenceChips, setChips, sourceLine, summaryLine, toleranceLine } from './model.model';

@Component({
  selector: 'or-model',
  imports: [BackLinkDirective, IonContent],
  template: `
    <ion-content>
      <div class="model" data-test="model">
        <header class="header">
          <a class="back" orBackLink="/textbook" [attr.aria-label]="texts.back" data-test="model-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>
        <p class="intro">{{ texts.intro }}</p>

        <section class="section" data-test="model-effects">
          <h2 class="label mono">{{ texts.effectsTitle }}</h2>
          @for (effect of texts.effects; track effect.title) {
            <p class="line"><b>{{ effect.title }}.</b> {{ effect.text }}</p>
          }
        </section>

        <section class="section" data-test="model-assumptions">
          <h2 class="label mono">{{ texts.assumptionsTitle }}</h2>
          <ul class="list">
            @for (assumption of assumptions(); track assumption) {
              <li>{{ assumption }}</li>
            }
          </ul>
        </section>

        <section class="section" data-test="model-formulas">
          <h2 class="label mono">{{ texts.formulasTitle }}</h2>
          <p class="line muted">{{ texts.formulasIntro }}</p>
          @for (formula of formulas(); track formula.title) {
            <div class="formula" data-test="model-formula">
              <h3 class="formula-title">{{ formula.title }}</h3>
              <div class="pair"><span class="key mono">{{ texts.playerLabel }}</span><span class="mono">{{ formula.formula }}</span></div>
              <div class="pair"><span class="key mono">{{ texts.coreLabel }}</span><span>{{ formula.core }}</span></div>
              <div class="pair"><span class="key mono">{{ texts.accuracyLabel }}</span><span>{{ formula.accuracy }}</span></div>
            </div>
          }
        </section>

        <section class="section" data-test="model-comparison">
          <h2 class="label mono">{{ texts.comparisonTitle }}</h2>
          <p class="line muted" data-test="model-source">{{ source() }}</p>
          <p class="line muted">{{ tolerance() }}</p>
          <div class="chips">
            @for (chip of cartridgeChips(); track chip.id) {
              <button class="chip" type="button" [class.chosen]="chip.isSelected" [attr.aria-pressed]="chip.isSelected" (click)="selectTable(chip.id)" [attr.data-test]="'model-cartridge-' + chip.id">{{ chip.label }}</button>
            }
          </div>
          <div class="chips">
            @for (chip of conditionChips(); track chip.id) {
              <button class="chip" type="button" [class.chosen]="chip.isSelected" [attr.aria-pressed]="chip.isSelected" (click)="selectedSetId.set(chip.id)" [attr.data-test]="'model-set-' + chip.id">{{ chip.label }}</button>
            }
          </div>

          @if (comparison(); as view) {
            <table class="table mono" data-test="model-table">
              <thead>
                <tr>
                  <th>{{ view.table.distanceHeader }}</th>
                  <th>{{ texts.ourUpHeader }}</th>
                  <th>{{ texts.referenceUpHeader }}</th>
                  <th>{{ texts.upDifferenceHeader }}</th>
                  <th>{{ texts.rightDifferenceHeader }}</th>
                  <th>{{ texts.timeDifferenceHeader }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of view.table.rows; track row.distance) {
                  <tr data-test="model-row">
                    <td>{{ row.distance }}</td>
                    <td data-test="model-our-up">{{ row.ourUp }}</td>
                    <td data-test="model-reference-up">{{ row.referenceUp }}</td>
                    <td>{{ row.upDifference }}</td>
                    <td>{{ row.rightDifference }}</td>
                    <td>{{ row.timeDifference }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="summary mono" data-test="model-summary">{{ view.summary }}</p>
          } @else {
            <p class="line muted mono" data-test="model-loading">{{ texts.loading }}</p>
          }
          <p class="line muted">{{ texts.alignment }}</p>
          @if (isInclineSet()) {
            <p class="line muted" data-test="model-incline-note">{{ texts.inclineNote }}</p>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .model { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .intro { margin: 0; font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .section { display: flex; flex-direction: column; gap: var(--space-2); }
    .label { margin: 0; font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .line { margin: 0; font: 400 var(--type-body) / 1.45 var(--font-text); color: var(--device-text); }
    .muted { color: var(--device-text-muted); }
    .list { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding-left: var(--space-4); font: 400 var(--type-body) / 1.45 var(--font-text); }
    .formula { display: flex; flex-direction: column; gap: 2px; padding: var(--space-2) 0; border-top: var(--border-width) solid var(--device-line); }
    .formula-title { margin: 0; font: 700 var(--type-value) / 1.25 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .pair { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--space-2); font: 400 var(--type-body) / 1.4 var(--font-text); overflow-wrap: anywhere; }
    .key { font: 500 var(--type-label) / 20px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .chip { min-height: var(--touch-min); padding: 0 var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 500 var(--type-label) / 16px var(--font-mono); }
    .chip.chosen { border-color: var(--device-accent); color: var(--device-accent); }
    .table { width: 100%; border-collapse: collapse; font: 500 12px / 18px var(--font-mono); font-variant-numeric: tabular-nums; }
    .table th { padding: var(--space-1) 2px; font-weight: 500; font-size: 10px; line-height: 14px; text-align: right; text-transform: uppercase; color: var(--device-text-muted); vertical-align: bottom; }
    .table td { padding: 2px; text-align: right; border-top: var(--border-width) solid var(--device-line); }
    .table th:first-child, .table td:first-child { text-align: left; }
    .summary { margin: 0; font: 500 var(--type-label) / 1.4 var(--font-mono); color: var(--device-text); }
  `,
})
export class ModelPage {
  private readonly progress = inject(ProgressStore);
  private readonly engine = new BallisticsEngine();
  protected readonly texts = text.model;
  private readonly selectedTableId = signal(REFERENCE_TABLES[0].id);
  protected readonly selectedSetId = signal(REFERENCE_TABLES[0].sets[0].id);
  private readonly unitSystem = computed(() => this.progress.settings().unitSystem);
  private readonly table = computed(() => REFERENCE_TABLES.find(table => table.id === this.selectedTableId())!);
  private readonly set = computed(() => this.table().sets.find(set => set.id === this.selectedSetId())!);

  protected readonly assumptions = computed(() => assumptionLines(this.unitSystem()));
  protected readonly formulas = computed(() => formulaRows(this.unitSystem()));
  protected readonly source = computed(() => sourceLine(this.table()));
  protected readonly tolerance = computed(() => toleranceLine(this.unitSystem()));
  protected readonly cartridgeChips = computed(() => referenceChips(this.selectedTableId()));
  protected readonly conditionChips = computed(() => setChips(this.table(), this.selectedSetId(), this.unitSystem()));
  protected readonly isInclineSet = computed(() => this.set().geometry.lookAngleDeg !== 0);

  private readonly rows = resource({
    params: () => ({ table: this.table(), set: this.set() }),
    loader: ({ params }) => comparedRows(this.engine, params.table, params.set),
  });

  protected readonly comparison = computed(() => {
    if (!this.rows.hasValue()) {
      return null;
    }
    const rows = this.rows.value();
    return { table: comparisonTableView(rows, this.unitSystem()), summary: summaryLine(comparisonSummary(rows, this.set().geometry.lookAngleDeg)) };
  });

  protected selectTable(tableId: string): void {
    this.selectedTableId.set(tableId);
  }
}
