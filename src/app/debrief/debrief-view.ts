import { Component, computed, input, output } from '@angular/core';
import { RULE_CARDS } from '../../core/content';
import { qualityLabel, TRIGGER_QUALITY_TEXT } from '../../sim/trigger';
import { ShotRecord } from '../services/progress.store';

const PLATE_VIEW_RADIUS = 50;
const PLATE_VIEW_CENTER = 60;

@Component({
  selector: 'or-debrief-view',
  template: `
    @let record = shot();
    <div class="debrief" data-test="debrief">
      <div class="row head">
        <span class="label">выстрел {{ record.shotNumber }} · {{ time() }}</span>
        <span class="spacer"></span>
        <span class="label">{{ record.distanceM }} м · Ø {{ plateCm() }} см</span>
      </div>
      <div class="row verdict-row">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-label="Мишень и точка попадания">
          <line x1="40" y1="110" x2="48" y2="80" class="leg" />
          <line x1="80" y1="110" x2="72" y2="80" class="leg" />
          <circle [attr.cx]="center" [attr.cy]="center" [attr.r]="plateRadius" class="plate" />
          <circle [attr.cx]="center" [attr.cy]="center" [attr.r]="plateRadius / 2" class="center-zone" />
          <circle [attr.cx]="impact().x" [attr.cy]="impact().y" r="4" [class.hit]="record.isHit" class="impact" />
        </svg>
        <div class="verdict">
          <b [class.ok-text]="record.isHit" [class.error-text]="!record.isHit" data-test="debrief-verdict">
            {{ record.isHit ? '✓ ПОПАДАНИЕ' : '✕ ПРОМАХ' }}
          </b>
          <span class="mono">{{ record.points }} очк. · {{ record.missMrad }} MIL от центра</span>
          <span class="mono">{{ direction() }}</span>
        </div>
      </div>

      <table class="mono contributions">
        <thead>
          <tr><th>Вклад, MIL</th><th>ввод</th><th>факт</th><th></th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Элевация</td><td>{{ record.dial.upMrad.toFixed(2) }}</td><td>{{ record.ideal.upMrad.toFixed(2) }}</td>
            <td class="cause">{{ record.cause === 'vertical' ? '← главная причина' : '' }}</td>
          </tr>
          <tr>
            <td>Ветер</td><td>{{ record.dial.rightMrad.toFixed(2) }}</td><td>{{ record.ideal.rightMrad.toFixed(2) }}</td>
            <td class="cause">{{ isWindCause() ? '← главная причина' : '' }}</td>
          </tr>
          <tr>
            <td>Удержание</td><td>0.00</td><td>{{ holdMil() }}</td>
            <td class="cause">{{ record.cause === 'hold' ? '← главная причина' : '' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="row facts">
        <span>Спуск: <b>{{ triggerText() }}</b></span>
        <span class="spacer"></span>
        <span class="mono">шанс {{ chance() }} % · удача {{ luck() }}</span>
      </div>

      <div class="card rule" data-test="debrief-rule">
        <b>{{ rule().title }}</b>
        <p>{{ record.verdict }}</p>
        <small>{{ rule().text }}</small>
      </div>

      <div class="row actions">
        <button class="button" (click)="toDope.emit()" data-test="debrief-dope">В DOPE</button>
        <button class="button primary" (click)="proceed.emit()" data-test="debrief-next">Дальше →</button>
      </div>
    </div>
  `,
  styles: `
    .debrief { display: flex; flex-direction: column; gap: 12px; }
    .verdict-row { align-items: center; }
    .verdict { display: flex; flex-direction: column; gap: 4px; }
    .verdict b { font: 700 24px/28px var(--font-sans); }
    .plate { fill: #6c7279; stroke: #2a2d31; stroke-width: 2; }
    .center-zone { fill: none; stroke: var(--hub-ok); stroke-dasharray: 3 3; }
    .leg { stroke: #2a2d31; stroke-width: 4; }
    .impact { fill: var(--hub-error); stroke: #fff; stroke-width: 1.5; }
    .impact.hit { fill: var(--hub-ok); }
    .contributions { width: 100%; border-collapse: collapse; font-size: 15px; }
    .contributions th { font: 500 13px var(--font-sans); color: var(--hub-text-2); text-align: left; padding: 4px; }
    .contributions td { border-top: 1px solid var(--hub-line); padding: 8px 4px; }
    .cause { color: var(--hub-accent); font: 500 13px var(--font-sans); }
    .facts { flex-wrap: wrap; font-size: 14px; }
    .rule p { margin: 6px 0; }
    .rule small { color: var(--hub-text-2); font-size: 13px; }
    .actions .button { flex: 1; }
  `,
})
export class DebriefView {
  readonly shot = input.required<ShotRecord>();
  readonly toDope = output<void>();
  readonly proceed = output<void>();

  protected readonly center = PLATE_VIEW_CENTER;
  protected readonly plateRadius = PLATE_VIEW_RADIUS;
  protected readonly rule = computed(() => RULE_CARDS[this.shot().cause]);
  protected readonly time = computed(() => new Date(this.shot().firedAtIso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  protected readonly plateCm = computed(() => Math.round(((this.shot().radiusMrad * this.shot().distanceM) / 1000) * 2 * 100));
  protected readonly isWindCause = computed(() => ['wind', 'flags', 'gust'].includes(this.shot().cause));
  protected readonly holdMil = computed(() => Math.hypot(this.shot().hold.upMrad, this.shot().hold.rightMrad).toFixed(2));
  protected readonly chance = computed(() => Math.round(this.shot().hitProbability * 100));
  protected readonly luck = computed(() => (this.shot().luck >= 0 ? '+' : '') + this.shot().luck.toFixed(2));
  protected readonly triggerText = computed(() => TRIGGER_QUALITY_TEXT[qualityLabel(this.shot().triggerQuality)].toLowerCase());
  protected readonly impact = computed(() => {
    const shot = this.shot();
    const scale = PLATE_VIEW_RADIUS / Math.max(shot.radiusMrad, 0.01);
    const clamp = (value: number): number => Math.max(6, Math.min(114, value));
    return { x: clamp(PLATE_VIEW_CENTER + shot.impact.rightMrad * scale), y: clamp(PLATE_VIEW_CENTER - shot.impact.upMrad * scale) };
  });
  protected readonly direction = computed(() => {
    const { upMrad, rightMrad } = this.shot().impact;
    const vertical = `${Math.abs(upMrad).toFixed(2)} ${upMrad >= 0 ? 'выше' : 'ниже'}`;
    const horizontal = `${Math.abs(rightMrad).toFixed(2)} ${rightMrad >= 0 ? 'правее' : 'левее'}`;
    return `${vertical}, ${horizontal}`;
  });
}
