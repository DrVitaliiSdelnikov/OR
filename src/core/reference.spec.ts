import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BallisticsEngine } from './engine';
import { Atmosphere, DragModel, Loadout, ShotGeometry, TwistDirection } from './types';

interface ReferenceRow {
  distanceM: number;
  upMil: number;
  impactRightMil: number;
  timeS: number;
  spinDriftRightMil: number;
}

interface ReferenceSet {
  id: string;
  atmosphere: Required<Atmosphere>;
  windZones: { speedMps: number; fromDeg: number }[];
  geometry: ShotGeometry;
  rows: ReferenceRow[];
}

interface Reference {
  source: { library: string; version: string; generatedAt: string };
  cartridge: {
    name: string;
    massG: number;
    bulletDiameterIn: number;
    bulletLengthMm: number;
    dragModel: DragModel;
    ballisticCoefficient: number;
    muzzleVelocityMps: number;
  };
  rifle: { sightHeightCm: number; zeroM: number; twistInchesPerTurn: number; twistDirection: TwistDirection };
  sets: ReferenceSet[];
}

const REFERENCE_DIR = 'src/core/reference';
const MAX_VERTICAL_MIL = 0.1;
const MAX_WIND_MIL = 0.05;
const MAX_SPIN_DRIFT_SHARE = 0.2;
const MAX_TIME_SHARE = 0.01;
const MAX_TIME_SHARE_ON_INCLINE = 0.015;
const EXPECTED_REFERENCES = ['223-77', '308-175', '338lm-300', '65cm-140'];

const references = readdirSync(REFERENCE_DIR)
  .filter(name => name.endsWith('.json'))
  .map(name => ({ id: name.replace('.json', ''), reference: JSON.parse(readFileSync(`${REFERENCE_DIR}/${name}`, 'utf-8')) as Reference }));

function loadoutOf(reference: Reference): Loadout {
  return {
    rifle: { name: reference.cartridge.name, groupSigmaMrad: 0, coldBoreShiftMil: { upMrad: 0, rightMrad: 0 }, ...reference.rifle },
    cartridge: { id: 'B', blurb: '', muzzleVelocitySdMps: 0, ...reference.cartridge },
  };
}

async function ourRows(engine: BallisticsEngine, loadout: Loadout, set: ReferenceSet, geometry: ShotGeometry) {
  const zones = set.windZones.map(zone => ({ untilM: Infinity, ...zone }));
  const points = await engine.trajectory(loadout, set.atmosphere, zones, undefined, undefined, geometry);
  return set.rows.map(row => {
    const required = BallisticsEngine.required(points, row.distanceM);
    return { upMil: required.upMrad, impactRightMil: -required.rightMrad, timeS: required.timeS };
  });
}

describe('сверка с эталоном lob (T1.3)', () => {
  it('эталоны на месте: 4 патрона × 3 набора, источник записан', () => {
    expect(references.map(item => item.id).sort()).toEqual(EXPECTED_REFERENCES);
    for (const { reference } of references) {
      expect(reference.sets).toHaveLength(3);
      expect(reference.source.library).toBe('@joelbenway/lob');
      expect(reference.source.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  for (const { id, reference } of references) {
    for (const set of reference.sets) {
      const maxTimeShare = set.geometry.lookAngleDeg === 0 ? MAX_TIME_SHARE : MAX_TIME_SHARE_ON_INCLINE;
      it(`${id} · ${set.id}: возвышение ≤ ${MAX_VERTICAL_MIL} MIL, ветер ≤ ${MAX_WIND_MIL} MIL, время ≤ ${maxTimeShare * 100} % до 1000 м`, async () => {
        const ours = await ourRows(new BallisticsEngine(), loadoutOf(reference), set, set.geometry);
        set.rows.forEach((row, index) => {
          const label = `${row.distanceM} м`;
          expect(Math.abs(ours[index].upMil - row.upMil), label).toBeLessThanOrEqual(MAX_VERTICAL_MIL);
          expect(Math.abs(ours[index].impactRightMil - row.impactRightMil), label).toBeLessThanOrEqual(MAX_WIND_MIL);
          expect(Math.abs(ours[index].timeS - row.timeS) / row.timeS, label).toBeLessThanOrEqual(maxTimeShare);
        });
      });
    }

    it(`${id}: деривация на 1000 м в пределах ±20 % от эталона`, async () => {
      const set = reference.sets[0];
      const engine = new BallisticsEngine();
      const loadout = loadoutOf(reference);
      const withSpin = await ourRows(engine, loadout, set, set.geometry);
      const withoutSpin = await ourRows(engine, loadout, set, { ...set.geometry, isSpinDriftOn: false });
      const ourSpinDrift = withSpin.at(-1)!.impactRightMil - withoutSpin.at(-1)!.impactRightMil;
      const referenceSpinDrift = set.rows.at(-1)!.spinDriftRightMil;
      expect(referenceSpinDrift).toBeGreaterThan(0);
      expect(Math.abs(ourSpinDrift - referenceSpinDrift) / referenceSpinDrift).toBeLessThanOrEqual(MAX_SPIN_DRIFT_SHARE);
    });
  }
});
