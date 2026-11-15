import { Component, computed, inject, input, resource } from '@angular/core';
import { BallisticsEngine } from '../../core/engine';
import { text } from '../../i18n';
import { buildProfileDopeCard } from '../../sim/profile-dope';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { deliverDopeImage, renderDopeImage } from './dope-image';
import { dopeTableView, exportFileName } from './dope-print.model';
import { IS_PRO_UNLOCKED } from './rifle.model';

@Component({
  selector: 'or-rifle-dope',
  imports: [BackLinkDirective],
  template: `
    <div class="page dope-page" data-test="rifle-dope-page">
      <header class="header no-print">
        <a class="back" orBackLink="/rifle" [attr.aria-label]="texts.back" data-test="rifle-dope-back">←</a>
        <h1 class="title">{{ texts.dope }}</h1>
      </header>

      @if (table(); as view) {
        <section class="sheet paper print-card" data-test="rifle-dope-card">
          <h2 class="card-title" data-test="rifle-dope-title">{{ view.title }}</h2>
          @for (line of view.headerLines; track $index) {
            <div class="card-line mono" data-test="rifle-dope-header">{{ line }}</div>
          }
          <div class="scroller">
            <table class="table mono">
              <thead>
                <tr>
                  @for (column of view.columns; track $index) {
                    <th [class.pinned]="$first">{{ column }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of view.rows; track row[0]) {
                  <tr data-test="rifle-dope-row">
                    @for (cell of row; track $index) {
                      <td [class.pinned]="$first">{{ cell }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        @if (isProUnlocked) {
          <div class="footer no-print">
            <button class="save" type="button" (click)="print()" data-test="rifle-print">{{ texts.card.print }}</button>
            <button class="cancel" type="button" (click)="exportImage()" data-test="rifle-image">{{ texts.card.image }}</button>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './rifle.styles.css',
})
export class RifleDopePage {
  private readonly progress = inject(ProgressStore);
  private readonly engine = new BallisticsEngine();
  readonly profileId = input.required<string>();
  protected readonly texts = text.rifle;
  protected readonly isProUnlocked = IS_PRO_UNLOCKED;
  private readonly profile = computed(() => this.progress.profiles().find(profile => profile.id === this.profileId()) ?? null);
  private readonly card = resource({
    params: () => ({ profile: this.profile(), system: this.progress.settings().unitSystem }),
    loader: ({ params }) => (params.profile ? buildProfileDopeCard(this.engine, params.profile, params.system) : Promise.resolve(null)),
  });
  protected readonly table = computed(() => {
    const card = this.card.hasValue() ? this.card.value() : null;
    return card ? dopeTableView(card) : null;
  });

  protected print(): void {
    window.print();
  }

  protected async exportImage(): Promise<void> {
    const view = this.table();
    const profile = this.profile();
    if (!view || !profile) {
      return;
    }
    await deliverDopeImage(await renderDopeImage(view), exportFileName(profile.name));
  }
}
