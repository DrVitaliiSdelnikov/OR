import { Component, effect, inject, signal, untracked } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { MAX_TRAJECTORY_M, RIFLE, TRAJECTORY_STEP_M } from '../../core/content';
import { BallisticsEngine } from '../../core/engine';
import { isTransonic } from '../../core/field';
import { formatScopeValue } from '../../sim/scope-model';
import { GameSession } from '../services/game-session';

export const DOPE_DISTANCES_M: readonly number[] = Array.from(
  { length: MAX_TRAJECTORY_M / TRAJECTORY_STEP_M },
  (_, index) => (index + 1) * TRAJECTORY_STEP_M,
);
export const DOPE_WIND_SPEEDS_MPS = [2, 4, 6] as const;

interface DopeRow {
  distanceM: number;
  elevation: string;
  winds: string[];
  isTransonic: boolean;
}

@Component({
  selector: 'or-dope',
  imports: [IonContent],
  templateUrl: './dope.page.html',
  styleUrl: './dope.page.scss',
})
export class DopePage {
  protected readonly session = inject(GameSession);
  protected readonly windSpeeds = DOPE_WIND_SPEEDS_MPS;
  protected readonly zeroM = RIFLE.zeroM;
  protected readonly rows = signal<DopeRow[]>([]);

  constructor() {
    effect(() => {
      const cartridge = this.session.cartridge();
      const atmosphere = this.session.playerAtmosphere();
      const scope = this.session.scope();
      untracked(() => void this.build(cartridge, atmosphere, scope));
    });
  }

  private async build(
    cartridge: ReturnType<GameSession['cartridge']>,
    atmosphere: ReturnType<GameSession['playerAtmosphere']>,
    scope: ReturnType<GameSession['scope']>,
  ): Promise<void> {
    const [calm, ...windy] = await Promise.all([
      this.session.engine.trajectory(cartridge, atmosphere, null),
      ...DOPE_WIND_SPEEDS_MPS.map(speedMps => this.session.engine.trajectory(cartridge, atmosphere, [{ untilM: Infinity, speedMps, fromDeg: 90 }])),
    ]);
    this.rows.set(
      DOPE_DISTANCES_M.map(distanceM => {
        const required = BallisticsEngine.required(calm, distanceM);
        return {
          distanceM,
          elevation: formatScopeValue(scope, required.upMrad),
          winds: windy.map(points => formatScopeValue(scope, Math.abs(BallisticsEngine.required(points, distanceM).rightMrad))),
          isTransonic: isTransonic(required.velocityMps, atmosphere.temperatureC),
        };
      }),
    );
  }
}
