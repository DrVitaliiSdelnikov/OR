import { Component, computed, input, output } from '@angular/core';
import { IntroPart } from './intro.model';

interface HitArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SchemeKind = 'rifle' | 'scope';

const HIT_AREAS: Record<SchemeKind, Record<string, HitArea>> = {
  rifle: {
    scope: { x: 118, y: 0, width: 120, height: 42 },
    barrel: { x: 244, y: 42, width: 92, height: 42 },
    bolt: { x: 196, y: 42, width: 46, height: 42 },
    trigger: { x: 134, y: 84, width: 48, height: 44 },
    magazine: { x: 184, y: 84, width: 50, height: 44 },
  },
  scope: {
    eyepiece: { x: 8, y: 40, width: 56, height: 64 },
    zoom: { x: 66, y: 40, width: 50, height: 64 },
    elevation: { x: 150, y: 4, width: 56, height: 44 },
    windage: { x: 150, y: 52, width: 56, height: 44 },
    objective: { x: 262, y: 30, width: 72, height: 84 },
  },
};

@Component({
  selector: 'or-part-scheme',
  template: `
    <svg viewBox="0 0 340 140" class="scheme" role="group" [attr.aria-label]="kind() === 'rifle' ? 'Винтовка сбоку' : 'Прицел в разрезе'" [attr.data-test]="'part-scheme-' + kind()">
      @if (kind() === 'rifle') {
        <path class="body" d="M10 70 L120 58 L196 56 L196 80 L130 84 L60 104 L18 104 Z" />
        <rect class="body" x="196" y="54" width="44" height="22" rx="2" />
        <rect class="metal" x="240" y="60" width="96" height="8" rx="2" />
        <rect class="metal" x="122" y="22" width="112" height="16" rx="6" />
        <rect class="metal" x="150" y="38" width="8" height="18" />
        <rect class="metal" x="198" y="38" width="8" height="18" />
        <circle class="metal" cx="218" cy="62" r="5" />
        <line class="metal-line" x1="218" y1="62" x2="232" y2="52" />
        <path class="metal-line" d="M152 84 Q156 100 166 98" />
        <path class="body-line" d="M140 84 Q140 108 170 108 L176 84" />
        <rect class="metal" x="190" y="80" width="34" height="38" rx="3" />
      } @else {
        <path class="metal" d="M14 54 L66 50 L66 94 L14 90 Z" />
        <rect class="metal" x="66" y="56" width="50" height="32" />
        <line class="metal-line" x1="76" y1="56" x2="76" y2="88" />
        <line class="metal-line" x1="88" y1="56" x2="88" y2="88" />
        <line class="metal-line" x1="100" y1="56" x2="100" y2="88" />
        <rect class="metal" x="116" y="60" width="150" height="24" />
        <rect class="metal" x="162" y="20" width="32" height="40" rx="3" />
        <circle class="metal" cx="178" cy="74" r="14" />
        <path class="metal" d="M266 50 L330 36 L330 108 L266 94 Z" />
        <ellipse class="lens" cx="324" cy="72" rx="6" ry="32" />
        <ellipse class="lens" cx="20" cy="72" rx="4" ry="16" />
        <line class="ray" x1="20" y1="72" x2="324" y2="72" />
      }
      @for (part of parts(); track part.id) {
        <g
          class="part"
          [class.seen]="seen().has(part.id)"
          role="button"
          tabindex="0"
          [attr.aria-label]="part.name"
          (click)="tapPart.emit(part.id)"
          (keydown.enter)="tapPart.emit(part.id)"
          [attr.data-test]="'part-' + part.id"
        >
          <rect class="hit" [attr.x]="area(part.id).x" [attr.y]="area(part.id).y" [attr.width]="area(part.id).width" [attr.height]="area(part.id).height" rx="4" />
          <text class="part-name" [attr.x]="area(part.id).x + area(part.id).width / 2" [attr.y]="area(part.id).y + area(part.id).height - 4">{{ part.name }}</text>
        </g>
      }
    </svg>
    <div class="tag mono" [class.empty]="!chosen()" data-test="part-caption">
      @if (chosen(); as part) {
        <b>{{ part.name }}.</b> {{ part.caption }}
      } @else {
        Тапни по части
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); }
    svg { width: 100%; }
    .body { fill: color-mix(in srgb, var(--device-accent) 25%, var(--device-surface)); stroke: var(--device-line-strong); stroke-width: 1.5; }
    .body-line { fill: none; stroke: var(--device-line-strong); stroke-width: 2; }
    .metal { fill: var(--device-surface-2); stroke: var(--device-line-strong); stroke-width: 1.5; }
    .metal-line { fill: none; stroke: var(--device-text-muted); stroke-width: 2; }
    .lens { fill: color-mix(in srgb, var(--device-accent) 20%, transparent); stroke: var(--device-text-muted); stroke-width: 1; }
    .ray { stroke: var(--device-accent); stroke-width: 0.8; stroke-dasharray: 4 4; }
    .part { cursor: pointer; outline: none; }
    .hit { fill: transparent; stroke: var(--device-accent); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .part-name { font: 600 8px var(--font-mono); fill: var(--device-text); text-anchor: middle; pointer-events: none; }
    .part.seen .hit { stroke: var(--device-ok); stroke-dasharray: none; }
    .tag { min-height: 72px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); font: 500 var(--type-label) / 1.4 var(--font-mono); }
    .tag.empty { color: var(--paper-graphite); }
  `,
})
export class PartSchemeComponent {
  readonly kind = input.required<SchemeKind>();
  readonly parts = input.required<readonly IntroPart[]>();
  readonly seen = input.required<ReadonlySet<string>>();
  readonly chosenId = input<string | null>(null);
  readonly tapPart = output<string>();

  protected readonly chosen = computed(() => this.parts().find(part => part.id === this.chosenId()) ?? null);

  protected area(partId: string): HitArea {
    return HIT_AREAS[this.kind()][partId];
  }
}
