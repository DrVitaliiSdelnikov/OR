import { cartridgeById, FLAG_DEG_PER_MPS, FLAG_DISTANCES_M, RIFLE, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from '../../core/content';
import { DopeCard, DopeRow, dopeRowAt } from '../../core/dope-card';
import { impactSoundDelayS, windClockShare } from '../../core/field';
import {
  atmosphereCorrectionMil,
  averageCrosswindMps,
  crosswindMps,
  leadMil,
  rangeByMilling,
  roundToClicks,
  windCorrectionMil,
} from '../../core/game-formulas';
import { CartridgeId } from '../../core/types';
import { text } from '../../i18n';
import type { TermTexts, TextbookChapter as CatalogChapter } from '../../i18n/ru/textbook';
import { MRAD_PER_MOA, scopeById } from '../../sim/scope-model';

const T = text.textbook;
const EXAMPLE = T.termExamples;

export const TEXTBOOK_CHAPTERS = T.chapters;

export type TextbookChapter = CatalogChapter;
export type CardsByCartridge = ReadonlyMap<CartridgeId, DopeCard>;

export interface TermFormula {
  line: string;
  variables: readonly { symbol: string; meaning: string }[];
}

export interface TermCard {
  term: string;
  forms?: readonly string[];
  chapter: TextbookChapter;
  phrase: string;
  formula?: TermFormula;
  example?: (cards: CardsByCartridge | null) => string | null;
  places: readonly string[];
  related: readonly string[];
}

const CLICK_MIL = 0.1;
const COURSE_SCOPE = scopeById('course-tree');
const MOA_SCOPE = scopeById('moa');
const CM_PER_MIL_PER_METRE = 0.1;
const GRAMS_PER_KG = 1000;
const ENERGY_ROUNDING_J = 10;
const ZONE_EXAMPLE_CROSSWINDS_MPS = [2, 3, 4, 0];
const ATMOSPHERE_COLUMN_STEP = 10;
const EXAMPLE_CARTRIDGE_ID: CartridgeId = 'B';
const EXAMPLE_CARTRIDGE_IDS: readonly CartridgeId[] = ['A', 'B', 'C'];
const COLD_BORE_EXAMPLE_DISTANCE_M = 300;
const CLICK_EXAMPLE = { correctionMil: 0.62, distanceM: 300 };
const MIL_EXAMPLE = { mil: 0.62, distanceM: 300 };
const MOA_EXAMPLE_MIL = 1.4;
const MILLING_EXAMPLE = { gongSizeM: 0.5, milledMil: 1.25 };
const DOPE_EXAMPLE_DISTANCE_M = 300;
const DOPE_ROW_EXAMPLE = { distanceM: 450, lowerM: 400, upperM: 500 };
const TIME_OF_FLIGHT_EXAMPLE_DISTANCE_M = 400;
const WIND_EXAMPLE = { speedMps: 3, clockHours: 9, distanceM: 300 };
const FLAG_EXAMPLE_ANGLE_DEG = 27;
const CROSSWIND_EXAMPLE = { speedMps: 4, clockHours: 2 };
const CLOCK_SHARE_EXAMPLE_HOURS = [3, 2, 1, 12];
const WIND_CONSTANT_EXAMPLE = { nearM: 200, farM: 600 };
const ZONES_EXAMPLE_DISTANCE_M = 500;
const ATMOSPHERE_EXAMPLE = { distanceM: 600, temperatureC: -5, pressureHpa: 1030 };
const LEAD_EXAMPLE = { targetSpeedMps: 1.1, clockHours: 3, distanceM: 400 };
const SECOND_SHOT_EXAMPLE = { rightMil: 0.3, downMil: 0.2 };

const CARD_TEXTS = T.terms({ rifleName: RIFLE.name, zeroM: RIFLE.zeroM, flagDistancesM: FLAG_DISTANCES_M });

type TermId = keyof typeof CARD_TEXTS;
type TermExample = (cards: CardsByCartridge | null) => string | null;

function cmOnTarget(mil: number, distanceM: number): number {
  return mil * distanceM * CM_PER_MIL_PER_METRE;
}

function exampleRow(cards: CardsByCartridge | null, distanceM: number): DopeRow | null {
  const card = cards?.get(EXAMPLE_CARTRIDGE_ID);
  return card ? dopeRowAt(card, distanceM) : null;
}

function clickCount(mil: number): number {
  return Math.abs(roundToClicks(mil, CLICK_MIL));
}

const exampleCartridgeName = (): string => cartridgeById(EXAMPLE_CARTRIDGE_ID).name;

const EXAMPLES: Partial<Record<TermId, TermExample>> = {
  coldBore: () => {
    const shift = RIFLE.coldBoreShiftMil;
    const distanceM = COLD_BORE_EXAMPLE_DISTANCE_M;
    return EXAMPLE.coldBore({
      rifleName: RIFLE.name,
      distanceM,
      upMil: shift.upMrad,
      upCm: cmOnTarget(shift.upMrad, distanceM),
      rightMil: shift.rightMrad,
      rightCm: cmOnTarget(shift.rightMrad, distanceM),
    });
  },
  magnification: () => EXAMPLE.magnification({ magnificationMin: COURSE_SCOPE.magnificationMin, magnificationMax: COURSE_SCOPE.magnificationMax }),
  click: () =>
    EXAMPLE.click({
      correctionMil: CLICK_EXAMPLE.correctionMil,
      clickMil: CLICK_MIL,
      exactClicks: CLICK_EXAMPLE.correctionMil / CLICK_MIL,
      clicks: clickCount(CLICK_EXAMPLE.correctionMil),
      distanceM: CLICK_EXAMPLE.distanceM,
      clickCm: cmOnTarget(CLICK_MIL, CLICK_EXAMPLE.distanceM),
    }),
  turret: () => EXAMPLE.turret({ elevationTravelMil: COURSE_SCOPE.elevationTravelMrad, windageTravelMil: COURSE_SCOPE.windageTravelMrad }),
  milling: () => EXAMPLE.milling({ ...MILLING_EXAMPLE, rangeM: rangeByMilling(MILLING_EXAMPLE.gongSizeM, MILLING_EXAMPLE.milledMil) }),
  mil: () => EXAMPLE.mil({ ...MIL_EXAMPLE, sizeCm: cmOnTarget(MIL_EXAMPLE.mil, MIL_EXAMPLE.distanceM) }),
  moa: () => EXAMPLE.moa({ mil: MOA_EXAMPLE_MIL, moa: MOA_EXAMPLE_MIL / MRAD_PER_MOA, moaClickMil: MOA_SCOPE.clickMrad }),
  cartridgeCard: () => {
    const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
    return EXAMPLE.cartridgeCard({
      name: cartridge.name,
      massG: cartridge.massG,
      muzzleVelocityMps: cartridge.muzzleVelocityMps,
      muzzleVelocitySdMps: cartridge.muzzleVelocitySdMps,
      bcG7: cartridge.bcG7,
    });
  },
  ballisticCoefficient: () => EXAMPLE.ballisticCoefficient({ cartridges: EXAMPLE_CARTRIDGE_IDS.map(id => ({ name: cartridgeById(id).name, bcG7: cartridgeById(id).bcG7 })) }),
  energy: () => {
    const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
    const massKg = cartridge.massG / GRAMS_PER_KG;
    const energyJ = (massKg * cartridge.muzzleVelocityMps ** 2) / 2;
    return EXAMPLE.energy({
      name: cartridge.name,
      massKg,
      muzzleVelocityMps: cartridge.muzzleVelocityMps,
      energyJ: Math.round(energyJ / ENERGY_ROUNDING_J) * ENERGY_ROUNDING_J,
    });
  },
  velocitySpread: () => {
    const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
    return EXAMPLE.velocitySpread({ name: cartridge.name, muzzleVelocityMps: cartridge.muzzleVelocityMps, muzzleVelocitySdMps: cartridge.muzzleVelocitySdMps });
  },
  dope: cards => {
    const row = exampleRow(cards, DOPE_EXAMPLE_DISTANCE_M);
    return row ? EXAMPLE.dope({ cartridgeName: exampleCartridgeName(), distanceM: DOPE_EXAMPLE_DISTANCE_M, elevationMil: row.elevationMil, clicks: row.clicks }) : null;
  },
  dopeRow: cards => {
    const lower = exampleRow(cards, DOPE_ROW_EXAMPLE.lowerM);
    const upper = exampleRow(cards, DOPE_ROW_EXAMPLE.upperM);
    const between = exampleRow(cards, DOPE_ROW_EXAMPLE.distanceM);
    return lower && upper && between
      ? EXAMPLE.dopeRow({
          cartridgeName: exampleCartridgeName(),
          ...DOPE_ROW_EXAMPLE,
          lowerMil: lower.elevationMil,
          upperMil: upper.elevationMil,
          elevationMil: between.elevationMil,
          clicks: between.clicks,
        })
      : null;
  },
  timeOfFlight: cards => {
    const distanceM = TIME_OF_FLIGHT_EXAMPLE_DISTANCE_M;
    const row = exampleRow(cards, distanceM);
    return row
      ? EXAMPLE.timeOfFlight({
          cartridgeName: exampleCartridgeName(),
          distanceM,
          timeOfFlightS: row.timeOfFlightS,
          soundDelayS: impactSoundDelayS(row.timeOfFlightS, distanceM, STANDARD_TEMPERATURE_C),
        })
      : null;
  },
  wind: cards => {
    const row = exampleRow(cards, WIND_EXAMPLE.distanceM);
    if (!row) {
      return null;
    }
    const correctionMil = Math.abs(windCorrectionMil(WIND_EXAMPLE.speedMps, WIND_EXAMPLE.clockHours, WIND_EXAMPLE.distanceM, row.windConstant));
    return EXAMPLE.wind({ ...WIND_EXAMPLE, windConstant: row.windConstant, correctionMil, clicks: clickCount(correctionMil) });
  },
  flag: () => EXAMPLE.flag({ angleDeg: FLAG_EXAMPLE_ANGLE_DEG, degPerMps: FLAG_DEG_PER_MPS, speedMps: FLAG_EXAMPLE_ANGLE_DEG / FLAG_DEG_PER_MPS }),
  crosswind: () =>
    EXAMPLE.crosswind({
      ...CROSSWIND_EXAMPLE,
      share: windClockShare(CROSSWIND_EXAMPLE.clockHours),
      crosswindMps: crosswindMps(CROSSWIND_EXAMPLE.speedMps, CROSSWIND_EXAMPLE.clockHours),
    }),
  clockShare: () => EXAMPLE.clockShare({ shares: CLOCK_SHARE_EXAMPLE_HOURS.map(clockHours => ({ clockHours, share: windClockShare(clockHours) })) }),
  windConstant: cards => {
    const near = exampleRow(cards, WIND_CONSTANT_EXAMPLE.nearM);
    const far = exampleRow(cards, WIND_CONSTANT_EXAMPLE.farM);
    return near && far
      ? EXAMPLE.windConstant({ cartridgeName: exampleCartridgeName(), ...WIND_CONSTANT_EXAMPLE, nearConstant: near.windConstant, farConstant: far.windConstant })
      : null;
  },
  windZones: cards => {
    const row = exampleRow(cards, ZONES_EXAMPLE_DISTANCE_M);
    return row ? EXAMPLE.windZones({ cartridgeName: exampleCartridgeName(), distanceM: ZONES_EXAMPLE_DISTANCE_M, weights: row.zoneWeights }) : null;
  },
  averageWind: cards => {
    const row = exampleRow(cards, ZONES_EXAMPLE_DISTANCE_M);
    if (!row) {
      return null;
    }
    return EXAMPLE.averageWind({
      distanceM: ZONES_EXAMPLE_DISTANCE_M,
      crosswindsMps: ZONE_EXAMPLE_CROSSWINDS_MPS,
      weights: row.zoneWeights,
      averageMps: averageCrosswindMps(ZONE_EXAMPLE_CROSSWINDS_MPS, row.zoneWeights),
    });
  },
  milFormula: () => EXAMPLE.milFormula({ ...MILLING_EXAMPLE, rangeM: rangeByMilling(MILLING_EXAMPLE.gongSizeM, MILLING_EXAMPLE.milledMil) }),
  atmosphereCorrection: cards => {
    const row = exampleRow(cards, ATMOSPHERE_EXAMPLE.distanceM);
    if (!row) {
      return null;
    }
    const { temperatureC, pressureHpa } = ATMOSPHERE_EXAMPLE;
    const correctionMil = atmosphereCorrectionMil(row, temperatureC, pressureHpa);
    return EXAMPLE.atmosphereCorrection({
      cartridgeName: exampleCartridgeName(),
      ...ATMOSPHERE_EXAMPLE,
      colderTens: (STANDARD_TEMPERATURE_C - temperatureC) / ATMOSPHERE_COLUMN_STEP,
      colderMil: row.colderBy10CMil,
      pressureTens: (pressureHpa - STANDARD_PRESSURE_HPA) / ATMOSPHERE_COLUMN_STEP,
      pressureMil: row.pressureUp10HpaMil,
      correctionMil,
      clicks: clickCount(correctionMil),
    });
  },
  lead: cards => {
    const row = exampleRow(cards, LEAD_EXAMPLE.distanceM);
    return row
      ? EXAMPLE.lead({
          targetSpeedMps: LEAD_EXAMPLE.targetSpeedMps,
          distanceM: LEAD_EXAMPLE.distanceM,
          timeOfFlightS: row.timeOfFlightS,
          leadMil: leadMil(LEAD_EXAMPLE.targetSpeedMps, LEAD_EXAMPLE.clockHours, row.timeOfFlightS, LEAD_EXAMPLE.distanceM),
        })
      : null;
  },
  secondShotCorrection: () =>
    EXAMPLE.secondShotCorrection({
      ...SECOND_SHOT_EXAMPLE,
      windageClicks: clickCount(SECOND_SHOT_EXAMPLE.rightMil),
      elevationClicks: clickCount(SECOND_SHOT_EXAMPLE.downMil),
    }),
};

function termCardOf(id: TermId): TermCard {
  const texts: TermTexts = CARD_TEXTS[id];
  const example = EXAMPLES[id];
  return example ? { ...texts, example } : texts;
}

export const TERM_CARDS: readonly TermCard[] = (Object.keys(CARD_TEXTS) as TermId[]).map(termCardOf);
