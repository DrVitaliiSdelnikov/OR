import { Component, computed, input } from '@angular/core';
import { CARTRIDGES } from '../../../core/content';
import { CardsByCartridge } from '../terms';
import { CartridgesSchemeComponent } from './cartridges-scheme.component';
import { FocalPlaneSchemeComponent } from './focal-plane-scheme.component';
import { GroupSchemeComponent } from './group-scheme.component';
import { ReticleSchemeComponent } from './reticle-scheme.component';
import { TermScheme } from './scheme.model';
import { TrajectorySchemeComponent } from './trajectory-scheme.component';
import { WindClockSchemeComponent } from './wind-clock-scheme.component';
import { ZonesSchemeComponent } from './zones-scheme.component';

const EXAMPLE_CARTRIDGE_ID = 'B';

@Component({
  selector: 'or-term-scheme',
  imports: [
    ReticleSchemeComponent,
    FocalPlaneSchemeComponent,
    TrajectorySchemeComponent,
    WindClockSchemeComponent,
    CartridgesSchemeComponent,
    ZonesSchemeComponent,
    GroupSchemeComponent,
  ],
  template: `
    <div class="scheme" [attr.data-scheme]="scheme()" data-test="term-scheme">
      @switch (scheme()) {
        @case ('reticle') {
          <or-reticle-scheme />
        }
        @case ('focal-plane') {
          <or-focal-plane-scheme />
        }
        @case ('wind-clock') {
          <or-wind-clock-scheme />
        }
        @case ('group') {
          <or-group-scheme />
        }
        @case ('trajectory') {
          @if (exampleCard(); as card) {
            <or-trajectory-scheme [card]="card" />
          } @else {
            <p class="pending mono" data-test="scheme-pending">считаю карточку…</p>
          }
        }
        @case ('zones') {
          @if (exampleCard(); as card) {
            <or-zones-scheme [card]="card" />
          } @else {
            <p class="pending mono" data-test="scheme-pending">считаю карточку…</p>
          }
        }
        @case ('cartridges') {
          @if (allCards(); as built) {
            <or-cartridges-scheme [cards]="built" />
          } @else {
            <p class="pending mono" data-test="scheme-pending">считаю карточки патронов…</p>
          }
        }
      }
    </div>
  `,
  styles: `
    .scheme { padding: var(--space-2) 0; border-top: 1px solid var(--paper-grid); border-bottom: 1px solid var(--paper-grid); }
    .pending { margin: 0; min-height: 120px; display: grid; place-items: center; font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-graphite); }
  `,
})
export class TermSchemeComponent {
  readonly scheme = input.required<TermScheme>();
  readonly cards = input<CardsByCartridge | null>(null);

  protected readonly exampleCard = computed(() => this.cards()?.get(EXAMPLE_CARTRIDGE_ID) ?? null);
  protected readonly allCards = computed(() => {
    const cards = this.cards();
    return cards && cards.size === CARTRIDGES.length ? cards : null;
  });
}
