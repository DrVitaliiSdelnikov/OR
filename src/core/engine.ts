import { Ammo, Atmo, Calculator, DragModel, DragTables, Shot, UNew, Unit, Weapon, Wind } from 'js-ballistics';
import { MAX_TRAJECTORY_M, RIFLE, TRAJECTORY_STEP_M } from './content';
import { Atmosphere, Cartridge, CartridgeId, RequiredCorrection, TrajectoryPoint, WindZone } from './types';

export class BallisticsEngine {
  private readonly calculator = new Calculator();
  private readonly zeroedWeapons = new Map<CartridgeId, Weapon>();

  async trajectory(
    cartridge: Cartridge,
    atmosphere: Atmosphere | null,
    windZones: readonly WindZone[] | null,
    muzzleVelocityMps = cartridge.muzzleVelocityMps,
  ): Promise<TrajectoryPoint[]> {
    const weapon = await this.zeroedWeapon(cartridge);
    const shot = new Shot({
      weapon,
      ammo: this.ammo(cartridge, muzzleVelocityMps),
      atmo: atmosphere ? this.atmo(atmosphere) : Atmo.standard(),
      winds: this.winds(windZones ?? []),
    });
    const result = await this.calculator.fire({
      shot,
      trajectoryRange: UNew.Meter(MAX_TRAJECTORY_M),
      trajectoryStep: UNew.Meter(TRAJECTORY_STEP_M),
    });
    return result.samples.map(sample => ({
      distanceM: Math.round(sample.distance.In(Unit.Meter)),
      dropMrad: sample.dropAngle.In(Unit.MRad),
      windageMrad: sample.windageAngle.In(Unit.MRad),
      timeS: sample.time,
      velocityMps: sample.velocity.In(Unit.MPS),
    }));
  }

  static required(points: readonly TrajectoryPoint[], distanceM: number): RequiredCorrection {
    const point = points.find(candidate => candidate.distanceM === distanceM);
    if (!point) {
      throw new Error(`no trajectory sample at ${distanceM} m`);
    }
    return {
      upMrad: -point.dropMrad,
      rightMrad: -point.windageMrad,
      timeS: point.timeS,
      velocityMps: point.velocityMps,
    };
  }

  static interpolated(points: readonly TrajectoryPoint[], distanceM: number): RequiredCorrection {
    const exact = points.find(point => point.distanceM === distanceM);
    if (exact) {
      return BallisticsEngine.required(points, distanceM);
    }
    const upperIndex = points.findIndex(point => point.distanceM > distanceM);
    if (upperIndex <= 0) {
      throw new Error(`distance ${distanceM} m is outside the trajectory`);
    }
    const lower = points[upperIndex - 1];
    const upper = points[upperIndex];
    const share = (distanceM - lower.distanceM) / (upper.distanceM - lower.distanceM);
    const blend = (from: number, to: number): number => from + (to - from) * share;
    return {
      upMrad: -blend(lower.dropMrad, upper.dropMrad),
      rightMrad: -blend(lower.windageMrad, upper.windageMrad),
      timeS: blend(lower.timeS, upper.timeS),
      velocityMps: blend(lower.velocityMps, upper.velocityMps),
    };
  }

  private async zeroedWeapon(cartridge: Cartridge): Promise<Weapon> {
    const cached = this.zeroedWeapons.get(cartridge.id);
    if (cached) {
      return cached;
    }
    const weapon = new Weapon({ sightHeight: UNew.Centimeter(RIFLE.sightHeightCm) });
    const zeroShot = new Shot({ weapon, ammo: this.ammo(cartridge, cartridge.muzzleVelocityMps), atmo: Atmo.standard() });
    await this.calculator.setWeaponZero(zeroShot, UNew.Meter(RIFLE.zeroM));
    this.zeroedWeapons.set(cartridge.id, weapon);
    return weapon;
  }

  private ammo(cartridge: Cartridge, muzzleVelocityMps: number): Ammo {
    const dragModel = new DragModel({
      bc: cartridge.bcG7,
      dragTable: DragTables['G7'],
      weight: UNew.Gram(cartridge.massG),
      diameter: UNew.Inch(RIFLE.bulletDiameterIn),
    });
    return new Ammo({ dm: dragModel, mv: UNew.MPS(muzzleVelocityMps) });
  }

  private atmo(atmosphere: Atmosphere): Atmo {
    return new Atmo({
      altitude: UNew.Meter(0),
      temperature: UNew.Celsius(atmosphere.temperatureC),
      pressure: UNew.hPa(atmosphere.pressureHpa),
      humidity: atmosphere.relativeHumidity,
    });
  }

  private winds(windZones: readonly WindZone[]): Wind[] {
    return windZones.map((zone, index) => {
      const isLastZone = index === windZones.length - 1 || !Number.isFinite(zone.untilM);
      return new Wind({
        velocity: UNew.MPS(zone.speedMps),
        directionFrom: UNew.Degree(zone.fromDeg),
        ...(isLastZone ? {} : { untilDistance: UNew.Meter(zone.untilM) }),
      });
    });
  }
}
