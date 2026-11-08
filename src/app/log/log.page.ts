import { Component, inject } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { ProgressStore } from '../services/progress.store';

@Component({
  selector: 'or-log',
  imports: [IonContent],
  template: `
    <ion-content>
      <div class="screen">
        <div class="top-bar"><h1>Журнал</h1></div>
        @for (shot of progress.shots(); track shot.id) {
          <div class="card row shot" [attr.data-test]="'log-' + shot.id">
            <span class="mark" [class.ok-text]="shot.isHit" [class.error-text]="!shot.isHit">{{ shot.isHit ? '✓' : '✕' }}</span>
            <span class="text">
              {{ shot.taskTitle }} · выстрел {{ shot.shotNumber }}
              <small class="mono">{{ shot.distanceM }} м · {{ shot.isHit ? 'попадание' : 'промах ' + shot.missMrad + ' MIL' }}</small>
            </span>
          </div>
        } @empty {
          <p class="empty" data-test="log-empty">Выстрелов пока нет.</p>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .shot { min-height: 56px; }
    .mark { font-size: 20px; width: 20px; }
    .text { flex: 1; display: flex; flex-direction: column; }
    small { color: var(--hub-text-2); font-size: 13px; }
    .empty { color: var(--hub-text-2); }
  `,
})
export class LogPage {
  protected readonly progress = inject(ProgressStore);
}
