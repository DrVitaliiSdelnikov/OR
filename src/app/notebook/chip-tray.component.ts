import { Component, computed, input, output } from '@angular/core';
import { Chip, ChipGroup, ChipKind } from '../../sim/notebook';
import { chipText } from './calc-sheet.model';

const GROUP_NAMES: Record<ChipGroup, string> = { instruments: 'Приборы', steps: 'Расчёт шагов', cartridge: 'Патрон' };
const GROUP_ORDER: readonly ChipGroup[] = ['instruments', 'steps', 'cartridge'];

interface ChipView {
  kind: ChipKind;
  value: string;
  source: string;
  isUsed: boolean;
  isAwaited: boolean;
}

@Component({
  selector: 'or-chip-tray',
  template: `
    <div class="tray" data-test="chip-tray">
      <div class="caption mono">Переменные · тап пишет в слот</div>
      @for (group of groups(); track group.name) {
        @if (isGrouped()) {
          <div class="group mono">{{ group.name }}</div>
        }
        <div class="variable-grid">
          @for (chip of group.chips; track chip.kind) {
            <button
              class="variable"
              type="button"
              [class.used]="chip.isUsed"
              [class.awaited]="chip.isAwaited"
              (click)="pick.emit(chip.kind)"
              [attr.data-test]="'chip-' + chip.kind"
              [attr.data-awaited]="chip.isAwaited"
            >
              <span class="value mono">{{ chip.value }}</span>
              <span class="source">{{ chip.source }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .tray { display: flex; flex-direction: column; gap: 6px; }
    .caption, .group { font: 500 11px / 14px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .variable-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .variable { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; min-height: 52px; padding: 4px 10px; border: 1px solid var(--device-line); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); text-align: left; }
    .variable.awaited { border: 2px solid var(--device-accent); }
    .variable.used { opacity: 0.45; }
    .value { font: 700 var(--type-body) / 20px var(--font-mono); }
    .source { font: 500 11px / 13px var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class ChipTrayComponent {
  readonly chips = input.required<Chip[]>();
  readonly usedKinds = input<ChipKind[]>([]);
  readonly awaitedKind = input<ChipKind | null>(null);
  readonly isGrouped = input(false);
  readonly distanceM = input<number | null>(null);
  readonly pick = output<ChipKind>();

  protected readonly groups = computed(() => {
    const used = new Set(this.usedKinds());
    const views = this.chips().map(chip => ({
      group: chip.group,
      view: { kind: chip.kind, ...chipText(chip, this.distanceM()), isUsed: used.has(chip.kind), isAwaited: chip.kind === this.awaitedKind() } as ChipView,
    }));
    if (!this.isGrouped()) {
      return [{ name: '', chips: views.map(item => item.view) }];
    }
    return GROUP_ORDER.map(group => ({ name: GROUP_NAMES[group], chips: views.filter(item => item.group === group).map(item => item.view) })).filter(group => group.chips.length > 0);
  });
}
