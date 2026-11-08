import { Component, computed, input, output, signal } from '@angular/core';
import { MILLING_GRID_MIL, MILLING_PT_PER_MIL, millingSize, snapMilling } from './notebook.model';

const GRID_WIDTH_PT = 140;
const GRID_HEIGHT_PT = MILLING_GRID_MIL * MILLING_PT_PER_MIL;
const GRID_CENTER_Y = GRID_HEIGHT_PT / 2;
const HASH_STEP_MIL = 0.5;

@Component({
  selector: 'or-distance-tab',
  template: `
    @if (knownText(); as known) {
      <div class="known mono" data-test="distance-known">{{ known }}</div>
    } @else {
      <div class="milling">
        <svg
          class="grid"
          [attr.viewBox]="'0 0 ' + gridWidth + ' ' + gridHeight"
          (pointerdown)="tap($event)"
          role="img"
          aria-label="Мини-сетка: коснись верха и низа гонга"
          data-test="milling-grid"
        >
          <line class="axis" [attr.x1]="gridWidth / 2" y1="0" [attr.x2]="gridWidth / 2" [attr.y2]="gridHeight" />
          @for (hash of hashes; track hash.y) {
            <line class="hash" [attr.x1]="gridWidth / 2 - hash.half" [attr.y1]="hash.y" [attr.x2]="gridWidth / 2 + hash.half" [attr.y2]="hash.y" />
          }
          <circle class="gong" [attr.cx]="gridWidth / 2" [attr.cy]="centerY" [attr.r]="gongRadius()" />
          @for (mark of marksPt(); track $index) {
            <line class="mark" x1="8" [attr.y1]="mark" [attr.x2]="gridWidth - 8" [attr.y2]="mark" data-test="milling-mark" />
          }
        </svg>
        <div class="side mono">
          <div class="formula">Д = размер × 1000 / MIL</div>
          <div data-test="milling-size">{{ sizeText() }}</div>
          <button class="count" type="button" [disabled]="sizeMil() === null" (click)="count()" data-test="milling-count">{{ isManual() ? 'К расчёту: шаг Дистанция →' : 'Посчитать' }}</button>
          @if (!isManual() && resultText(); as result) {
            <div class="result" data-test="milling-result">{{ result }}</div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .known { font: 500 var(--type-body) / 22px var(--font-mono); color: var(--paper-ink); }
    .milling { display: grid; grid-template-columns: 140px 1fr; gap: var(--space-2); align-items: start; }
    .grid { width: 140px; height: 180px; background: var(--device-sunken); border-radius: var(--radius-device); touch-action: none; }
    .axis, .hash { stroke: var(--device-text-muted); stroke-width: 1; }
    .gong { fill: var(--device-text-muted); opacity: 0.55; }
    .mark { stroke: var(--device-accent); stroke-width: 2; }
    .side { display: flex; flex-direction: column; gap: var(--space-2); font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-ink); }
    .formula { font-weight: 700; }
    .count { min-height: var(--touch-min); border: none; border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .count:disabled { opacity: 0.45; }
    .result { font: 700 var(--type-body) / 20px var(--font-mono); }
  `,
})
export class DistanceTabComponent {
  readonly knownText = input<string | null>(null);
  readonly gongMil = input(0);
  readonly resultText = input<string | null>(null);
  readonly isManual = input(false);
  readonly measure = output<number>();

  protected readonly gridWidth = GRID_WIDTH_PT;
  protected readonly gridHeight = GRID_HEIGHT_PT;
  protected readonly centerY = GRID_CENTER_Y;
  protected readonly hashes = Array.from({ length: MILLING_GRID_MIL / HASH_STEP_MIL + 1 }, (_, index) => ({
    y: index * HASH_STEP_MIL * MILLING_PT_PER_MIL,
    half: index % 2 === 0 ? 14 : 8,
  }));
  protected readonly gongRadius = computed(() => (this.gongMil() * MILLING_PT_PER_MIL) / 2);
  protected readonly marksMil = signal<number[]>([]);
  protected readonly marksPt = computed(() => this.marksMil().map(mil => GRID_CENTER_Y - mil * MILLING_PT_PER_MIL));
  protected readonly sizeMil = computed(() => {
    const marks = this.marksMil();
    return marks.length === 2 ? millingSize(marks[0], marks[1]) : null;
  });
  protected readonly sizeText = computed(() => {
    const size = this.sizeMil();
    return size === null ? 'Коснись верха и низа гонга' : `размер на сетке: ${size.toFixed(2)} MIL`;
  });

  protected tap(event: PointerEvent): void {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const yPt = ((event.clientY - rect.top) / rect.height) * GRID_HEIGHT_PT;
    const mil = snapMilling((GRID_CENTER_Y - yPt) / MILLING_PT_PER_MIL);
    this.marksMil.update(marks => (marks.length === 2 ? [mil] : [...marks, mil]));
  }

  protected count(): void {
    const size = this.sizeMil();
    if (size !== null && size > 0) {
      this.measure.emit(size);
    }
  }
}
