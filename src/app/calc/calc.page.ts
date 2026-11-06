import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { formatClock } from '../../core/field';
import { clicksFor, formatScopeValue } from '../../sim/scope-model';
import { DISTANCE_STEP_M, GameSession } from '../services/game-session';

const CHART_WIDTH = 322;
const CHART_HEIGHT = 104;
const CHART_LEFT = 14;
const CHART_RIGHT = 308;
const CHART_TOP = 18;
const CHART_BOTTOM = 82;
const WIND_STEP_MPS = 0.5;

@Component({
  selector: 'or-calc',
  imports: [IonContent, RouterLink],
  templateUrl: './calc.page.html',
  styleUrl: './calc.page.scss',
})
export class CalcPage {
  private readonly router = inject(Router);
  protected readonly session = inject(GameSession);
  protected readonly distanceStep = DISTANCE_STEP_M;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly chartBottom = CHART_BOTTOM;
  protected readonly chartLeft = CHART_LEFT;
  protected readonly chartRight = CHART_RIGHT;

  protected readonly units = computed(() => this.session.scope().units);
  protected readonly elevation = computed(() => {
    const solution = this.session.solution();
    const scope = this.session.scope();
    return solution ? { value: formatScopeValue(scope, solution.required.upMrad), clicks: clicksFor(scope, solution.required.upMrad) } : null;
  });
  protected readonly windage = computed(() => {
    const solution = this.session.solution();
    const scope = this.session.scope();
    if (!solution) {
      return null;
    }
    const rightMrad = solution.required.rightMrad;
    return {
      value: formatScopeValue(scope, Math.abs(rightMrad)),
      clicks: Math.abs(clicksFor(scope, rightMrad)),
      side: rightMrad < 0 ? 'L' : 'R',
    };
  });
  protected readonly windChips = computed(() => {
    const speed = this.session.windInput().speedMps;
    return [speed - WIND_STEP_MPS, speed, speed + WIND_STEP_MPS].map(value => Math.max(0, Math.round(value * 10) / 10));
  });
  protected readonly clockText = computed(() => formatClock(this.session.windInput().clockHours));

  protected readonly chart = computed(() => {
    const solution = this.session.solution();
    if (!solution) {
      return null;
    }
    const points = solution.points;
    const maxDistance = points[points.length - 1].distanceM;
    const maxDrop = Math.max(...points.map(point => -point.dropMrad), 1);
    const x = (distanceM: number): number => CHART_LEFT + ((CHART_RIGHT - CHART_LEFT) * distanceM) / maxDistance;
    const y = (dropMrad: number): number => CHART_BOTTOM - ((CHART_BOTTOM - CHART_TOP) * Math.max(0, dropMrad)) / maxDrop;
    return {
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.distanceM).toFixed(1)},${y(-point.dropMrad).toFixed(1)}`).join(' '),
      markerX: x(solution.distanceM),
      markerY: y(solution.required.upMrad),
      ticks: [0, 200, 400, 600].map(distanceM => ({ distanceM, x: x(distanceM) })),
    };
  });

  protected changeWind(speedMps: number): void {
    this.session.windInput.update(input => ({ ...input, speedMps: Math.max(0, speedMps) }));
  }

  protected stepWind(direction: 1 | -1): void {
    this.changeWind(Math.round((this.session.windInput().speedMps + direction * WIND_STEP_MPS) * 10) / 10);
  }

  protected toTurrets(): void {
    void this.router.navigate(['/scope']);
  }
}
