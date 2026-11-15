import { Ammo, Atmo, Calculator, DEFAULT_CONFIG, DragModel, DragTables, Shot, UNew, Unit, Weapon, Wind } from 'js-ballistics';
import { FLAT_GEOMETRY, MAX_TRAJECTORY_M, TRAJECTORY_STEP_M } from './content';
import { Atmosphere, Cartridge, Loadout, RequiredCorrection, ShotGeometry, TrajectoryPoint, WindZone } from './types';

const RADIANS_PER_DEGREE = Math.PI / 180;
const DOWNHILL_MINIMUM_ALTITUDE_FT = DEFAULT_CONFIG.maximumDrop;

export class BallisticsEngine {
  private readonly calculator = new Calculator({ config: { ...DEFAULT_CONFIG, minimumAltitude: DOWNHILL_MINIMUM_ALTITUDE_FT } });
  private readonly zeroedWeapons = new Map<string, Promise<Weapon>>();

  async trajectory(
    loadout: Loadout,
    atmosphere: Atmosphere | null,
    windZones: readonly WindZone[] | null,
    muzzleVelocityMps = loadout.cartridge.muzzleVelocityMps,
    stepM = TRAJECTORY_STEP_M,
    geometry: ShotGeometry = FLAT_GEOMETRY,
    rangeM = MAX_TRAJECTORY_M,
  ): Promise<TrajectoryPoint[]> {
    const zeroed = await this.zeroedWeapon(loadout);
    const horizontalPerSlant = Math.cos(geometry.lookAngleDeg * RADIANS_PER_DEGREE);
    const shot = new Shot({
      weapon: geometry.isSpinDriftOn ? this.spinningWeapon(loadout, zeroed) : zeroed,
      ammo: this.ammo(loadout.cartridge, muzzleVelocityMps, geometry.isSpinDriftOn),
      atmo: atmosphere ? this.atmo(atmosphere) : Atmo.standard(),
      winds: this.winds(windZones ?? [], horizontalPerSlant),
      lookAngle: UNew.Degree(geometry.lookAngleDeg),
      ...(geometry.coriolis ? { coriolis: { latitudeDeg: geometry.coriolis.latitudeDeg, azimuthDeg: geometry.coriolis.azimuthDeg } } : {}),
    });
    const result = await this.calculator.fire({
      shot,
      trajectoryRange: UNew.Meter(rangeM * horizontalPerSlant),
      trajectoryStep: UNew.Meter(stepM * horizontalPerSlant),
    });
    return result.samples.map(sample => ({
      distanceM: Math.round(sample.distance.In(Unit.Meter) / horizontalPerSlant),
      dropMrad: sample.dropAngle.In(Unit.MRad),
      windageMrad: sample.windageAngle.In(Unit.MRad),
      timeS: sample.time,
      velocityMps: sample.velocity.In(Unit.MPS),
    }));
  }

  async zeroAngleMil(loadout: Loadout): Promise<number> {
    return (await this.zeroedWeapon(loadout)).zeroElevation.In(Unit.MRad);
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

  private zeroedWeapon(loadout: Loadout): Promise<Weapon> {
    const key = zeroKey(loadout);
    const cached = this.zeroedWeapons.get(key);
    if (cached) {
      return cached;
    }
    const zeroing = this.zeroWeapon(loadout);
    this.zeroedWeapons.set(key, zeroing);
    return zeroing;
  }

  private spinningWeapon({ rifle }: Loadout, zeroed: Weapon): Weapon {
    const twistInches = rifle.twistDirection === 'left' ? -rifle.twistInchesPerTurn : rifle.twistInchesPerTurn;
    return new Weapon({ sightHeight: zeroed.sightHeight, twist: UNew.Inch(twistInches), zeroElevation: zeroed.zeroElevation });
  }

  private async zeroWeapon({ rifle, cartridge }: Loadout): Promise<Weapon> {
    const weapon = new Weapon({ sightHeight: UNew.Centimeter(rifle.sightHeightCm) });
    const zeroShot = new Shot({ weapon, ammo: this.ammo(cartridge, cartridge.muzzleVelocityMps), atmo: Atmo.standard() });
    await this.calculator.setWeaponZero(zeroShot, UNew.Meter(rifle.zeroM));
    return weapon;
  }

  private ammo(cartridge: Cartridge, muzzleVelocityMps: number, hasBulletLength = false): Ammo {
    const dragModel = new DragModel({
      bc: cartridge.ballisticCoefficient,
      dragTable: DragTables[cartridge.dragModel],
      weight: UNew.Gram(cartridge.massG),
      diameter: UNew.Inch(cartridge.bulletDiameterIn),
      ...(hasBulletLength ? { length: UNew.Millimeter(cartridge.bulletLengthMm) } : {}),
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

  private winds(windZones: readonly WindZone[], horizontalPerSlant: number): Wind[] {
    return windZones.map((zone, index) => {
      const isLastZone = index === windZones.length - 1 || !Number.isFinite(zone.untilM);
      return new Wind({
        velocity: UNew.MPS(zone.speedMps),
        directionFrom: UNew.Degree(zone.fromDeg),
        ...(isLastZone ? {} : { untilDistance: UNew.Meter(zone.untilM * horizontalPerSlant) }),
      });
    });
  }
}

function zeroKey({ rifle, cartridge }: Loadout): string {
  return [
    rifle.sightHeightCm,
    rifle.zeroM,
    cartridge.bulletDiameterIn,
    cartridge.massG,
    cartridge.dragModel,
    cartridge.ballisticCoefficient,
    cartridge.muzzleVelocityMps,
  ].join('|');
}
