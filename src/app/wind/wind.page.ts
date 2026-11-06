import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { crosswindByClockRule, formatClock, windClockShare } from '../../core/field';
import { degFromClock } from '../../core/scenario';
import { formatScopeValue } from '../../sim/scope-model';
import { GameSession } from '../services/game-session';

const DIAL_RADIUS = 110;
const DIAL_CENTER = 130;
const CLOCK_STEP_HOURS = 0.5;
const SPEED_WHEEL_MPS = Array.from({ length: 25 }, (_, index) => index * 0.5);

@Component({
  selector: 'or-wind',
  imports: [IonContent],
  templateUrl: './wind.page.html',
  styleUrl: './wind.page.scss',
})
export class WindPage {
  private readonly router = inject(Router);
  protected readonly session = inject(GameSession);
  protected readonly speeds = SPEED_WHEEL_MPS;
  protected readonly dialCenter = DIAL_CENTER;
  protected readonly clockHours = signal(this.session.windInput().clockHours);
  protected readonly speedMps = signal(this.session.windInput().speedMps);

  protected readonly hourMarks = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 1;
    const angle = (hour / 12) * 2 * Math.PI;
    return { hour, x: DIAL_CENTER + Math.sin(angle) * (DIAL_RADIUS - 18), y: DIAL_CENTER - Math.cos(angle) * (DIAL_RADIUS - 18) };
  });
  protected readonly positions = Array.from({ length: 24 }, (_, index) => {
    const hours = index * CLOCK_STEP_HOURS;
    const angle = (hours / 12) * 2 * Math.PI;
    return { hours, x: DIAL_CENTER + Math.sin(angle) * DIAL_RADIUS, y: DIAL_CENTER - Math.cos(angle) * DIAL_RADIUS };
  });

  protected readonly arrow = computed(() => {
    const angle = (this.clockHours() / 12) * 2 * Math.PI;
    return { x: DIAL_CENTER + Math.sin(angle) * (DIAL_RADIUS - 30), y: DIAL_CENTER - Math.cos(angle) * (DIAL_RADIUS - 30) };
  });
  protected readonly share = computed(() => windClockShare(this.clockHours()));
  protected readonly crosswind = computed(() => crosswindByClockRule(this.speedMps(), this.clockHours()));
  protected readonly clockText = computed(() => formatClock(this.clockHours()));
  protected readonly correctionText = computed(() => {
    const solution = this.session.solution();
    if (!solution) {
      return '—';
    }
    const isFromLeft = degFromClock(this.clockHours()) < 180;
    const lateralMrad = solution.windageMradPerMps * this.crosswind();
    return `${formatScopeValue(this.session.scope(), lateralMrad)} ${this.session.scope().units} ${isFromLeft ? 'L' : 'R'}`;
  });

  protected selectClock(hours: number): void {
    this.clockHours.set(hours === 0 ? 12 : hours);
  }

  protected apply(): void {
    this.session.windInput.set({ speedMps: this.speedMps(), clockHours: this.clockHours() });
    void this.router.navigate(['/tabs/calc']);
  }
}
