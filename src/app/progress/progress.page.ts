import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { errorTypeRows, levelView, skillRows, weeklyLevels } from './progress.model';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;
const CHART_PADDING = 12;
const CHART_GRID_LEVELS = [25, 50, 75];
const RATING_MAX = 100;

@Component({
  selector: 'or-progress',
  imports: [BackLinkDirective, IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="progress" data-test="progress">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="progress-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>

        <section class="level-block">
          <div class="level" [class.unknown]="!level().isKnown" data-test="progress-level">{{ level().text }}</div>
          @if (!level().isKnown) {
            <div class="hint">{{ texts.levelHint }}</div>
          }
        </section>

        <section class="block">
          <h2 class="block-title mono">{{ texts.weeksTitle }}</h2>
          <svg class="chart" [attr.viewBox]="chartViewBox" role="img" [attr.aria-label]="texts.weeksTitle" data-test="progress-chart">
            @for (gridY of gridLines; track gridY) {
              <line class="grid" x1="0" [attr.x2]="chartWidth" [attr.y1]="gridY" [attr.y2]="gridY" />
            }
            <polyline class="line" [attr.points]="chartPoints()" />
            @for (dot of chartDots(); track dot.x) {
              <circle class="dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" data-test="progress-chart-dot" />
            }
          </svg>
          <div class="weeks mono">
            @for (week of weeks(); track week.label) {
              <span class="week" data-test="progress-week">{{ week.level ?? '·' }}<small>{{ week.label }}</small></span>
            }
          </div>
        </section>

        <section class="block">
          <h2 class="block-title mono">{{ texts.skillsTitle }}</h2>
          @for (row of skills(); track row.skill) {
            <div class="skill" [class.unrated]="!row.isRated" [attr.data-test]="'progress-skill-' + row.skill">
              <span class="skill-title">{{ row.title }}</span>
              <span class="skill-rating mono">{{ row.rating }}</span>
              <span class="bar"><span class="bar-fill" [style.width.%]="row.share * 100"></span></span>
              <span class="skill-attempts mono">{{ row.attempts }}</span>
            </div>
          }
        </section>

        <section class="block">
          <h2 class="block-title mono">{{ texts.errorsTitle }}</h2>
          @for (row of errors(); track row.type) {
            <div class="error mono" data-test="progress-error"><span>{{ row.label }}</span><span>{{ texts.errorCount({ count: row.count }) }}</span></div>
          } @empty {
            <div class="hint" data-test="progress-no-errors">{{ texts.noErrors }}</div>
          }
        </section>

        <a class="journal" routerLink="/journal" data-test="progress-journal">{{ texts.journal }}</a>
      </div>
    </ion-content>
  `,
  styles: `
    .progress { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .level { font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-accent); }
    .level.unknown { color: var(--device-text-muted); }
    .hint { font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .block { display: flex; flex-direction: column; gap: var(--space-2); }
    .block-title { margin: 0; font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .chart { width: 100%; height: auto; border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); }
    .grid { stroke: var(--device-line); stroke-width: 1; stroke-dasharray: 2 4; }
    .line { fill: none; stroke: var(--device-accent); stroke-width: 2; }
    .dot { fill: var(--device-accent); }
    .weeks { display: grid; grid-template-columns: repeat(8, 1fr); text-align: center; font: 700 var(--type-label) / 16px var(--font-mono); color: var(--device-text); }
    .week { display: flex; flex-direction: column; }
    .week small { font-weight: 500; color: var(--device-text-muted); }
    .skill { display: grid; grid-template-columns: 1fr auto; gap: 4px var(--space-2); padding: var(--space-2) var(--space-3); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); }
    .skill-title { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .skill-rating { font: 700 var(--type-value) / 20px var(--font-mono); color: var(--device-accent); }
    .skill.unrated .skill-rating { color: var(--device-text-muted); }
    .bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: var(--device-line); overflow: hidden; }
    .bar-fill { display: block; height: 100%; background: var(--device-accent); }
    .skill.unrated .bar-fill { background: var(--device-text-muted); }
    .skill-attempts { grid-column: 1 / -1; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
    .error { display: flex; justify-content: space-between; align-items: center; min-height: var(--touch-min); padding: 0 var(--space-3); border-bottom: 1px solid var(--device-line); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); }
    .journal { display: grid; place-items: center; min-height: var(--button-main-height); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); color: var(--device-text); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; text-decoration: none; }
  `,
})
export class ProgressPage {
  private readonly progress = inject(ProgressStore);
  protected readonly texts = text.skills.progress;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartViewBox = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
  protected readonly gridLines = CHART_GRID_LEVELS.map(chartY);
  protected readonly level = computed(() => levelView(this.progress.skills()));
  protected readonly skills = computed(() => skillRows(this.progress.skills()));
  protected readonly errors = computed(() => errorTypeRows(this.progress.journal(), this.progress.drillRounds(), new Date().toISOString()));
  protected readonly weeks = computed(() => weeklyLevels(this.progress.journal(), this.progress.drillRounds(), new Date().toISOString(), this.progress.skills()));
  protected readonly chartDots = computed(() => {
    const columnWidth = CHART_WIDTH / this.weeks().length;
    return this.weeks().flatMap((week, index) => (week.level === null ? [] : [{ x: columnWidth * index + columnWidth / 2, y: chartY(week.level) }]));
  });
  protected readonly chartPoints = computed(() => this.chartDots().map(dot => `${dot.x},${dot.y}`).join(' '));
}

function chartY(level: number): number {
  return CHART_HEIGHT - CHART_PADDING - (level / RATING_MAX) * (CHART_HEIGHT - 2 * CHART_PADDING);
}
