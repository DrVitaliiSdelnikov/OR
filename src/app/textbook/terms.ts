import { standardPressureHpaAt } from '../../core/scenario';
import { cartridgeById, COURSE_RIFLE, courseLoadout, FLAG_DEG_PER_MPS, rangeLayout, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from '../../core/content';
import { DopeCard, DopeRow, dopeRowAt } from '../../core/dope-card';
import { impactSoundDelayS, windClockShare } from '../../core/field';
import {
  atmosphereCorrectionMil,
  atmosphereCorrectionMilImperial,
  averageCrosswindMps,
  crosswindMps,
  imperialWindConstant,
  IMPERIAL_COLDER_STEP_F,
  IMPERIAL_PRESSURE_STEP_INHG,
  leadMil,
  leadMilImperial,
  rangeByMilling,
  roundToClicks,
  STANDARD_PRESSURE_INHG,
  STANDARD_TEMPERATURE_F,
  windCorrectionMil,
} from '../../core/game-formulas';
import { CartridgeId } from '../../core/types';
import { fromInput, toDisplay, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import type { TermTexts, TextbookChapter as CatalogChapter } from '../../i18n/ru/textbook';
import { MRAD_PER_MOA, scopeById } from '../../sim/scope-model';

const T = text.textbook;
const EXAMPLE = T.termExamples;
const UNITS = text.units;

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
const ENERGY_ROUNDING = 10;
const IMPERIAL_ENERGY_DIVISOR = 450240;
const ATMOSPHERE_COLUMN_STEP = 10;
const EXAMPLE_CARTRIDGE_ID: CartridgeId = 'B';
const EXAMPLE_CARTRIDGE_IDS: readonly CartridgeId[] = ['A', 'B', 'C'];
const COLD_BORE_EXAMPLE_DISTANCE = 300;
const CLICK_EXAMPLE = { correctionMil: 0.62, distance: 300 };
const MIL_EXAMPLE = { mil: 0.62, distance: 300 };
const MIL_SIZE_DIVISOR: Record<UnitSystem, string> = { metric: '10', imperial: '27,78' };
const MILLING_FACTOR: Record<UnitSystem, string> = { metric: '1000', imperial: '27,78' };
const MOA_EXAMPLE_MIL = 1.4;
const MILLING_EXAMPLE = { gongSize: { metric: 0.5, imperial: 20 }, milledMil: 1.25 };
const DOPE_EXAMPLE_DISTANCE = 300;
const DOPE_ROW_EXAMPLE = { distance: 450, lower: 400, upper: 500 };
const TIME_OF_FLIGHT_EXAMPLE_DISTANCE = 400;
const WIND_EXAMPLE = { speed: { metric: 3, imperial: 7 }, clockHours: 9, distance: 300 };
const FLAG_EXAMPLE_ANGLE_DEG = 27;
const CROSSWIND_EXAMPLE = { speed: { metric: 4, imperial: 9 }, clockHours: 2 };
const CLOCK_SHARE_EXAMPLE_HOURS = [3, 2, 1, 12];
const WIND_CONSTANT_EXAMPLE = { near: 200, far: 600 };
const ZONES_EXAMPLE_DISTANCE = 500;
const ZONE_EXAMPLE_CROSSWINDS: Record<UnitSystem, readonly number[]> = { metric: [2, 3, 4, 0], imperial: [4, 7, 9, 0] };
const ATMOSPHERE_EXAMPLE = { distance: 600, temperature: { metric: -5, imperial: 23 }, pressure: { metric: 1030, imperial: 30.42 } };
const LEAD_EXAMPLE = { targetSpeed: { metric: 1.1, imperial: 2.5 }, clockHours: 3, distance: 400 };
const SECOND_SHOT_EXAMPLE = { rightMil: 0.3, downMil: 0.2 };
const LOOK_ANGLE_EXAMPLE = { upDeg: 15, downDeg: 15 };
const COSINE_EXAMPLE = { distance: 600, angleDeg: 25 };
const ALTITUDE_EXAMPLE = { lowAltitude: 0, highAltitude: { metric: 1500, imperial: 5000 } };
const EARTH_EXAMPLE = { distance: 1000, latitudeDeg: 55, azimuthDeg: 90 };
const EARTH_ROTATION_MIL_PER_S = 0.0729;
const RADIANS_PER_DEGREE = Math.PI / 180;
const CHIP_TRIG_SCALE = 100;
const SPEED_DIGITS = 2;

type TermId = keyof ReturnType<typeof T.terms>;
type TermExample = (cards: CardsByCartridge | null) => string | null;

const chipTrig = (trig: (radians: number) => number, degrees: number): number => Math.round(trig(degrees * RADIANS_PER_DEGREE) * CHIP_TRIG_SCALE) / CHIP_TRIG_SCALE;

const exampleCartridgeName = (): string => cartridgeById(EXAMPLE_CARTRIDGE_ID).name;

function clickCount(mil: number): number {
  return Math.abs(roundToClicks(mil, CLICK_MIL));
}

function exampleRow(cards: CardsByCartridge | null, distanceM: number): DopeRow | null {
  const card = cards?.get(EXAMPLE_CARTRIDGE_ID);
  return card ? dopeRowAt(card, distanceM) : null;
}

function examplesIn(system: UnitSystem): Partial<Record<TermId, TermExample>> {
  const metres = (distance: number): number => fromInput('distance', distance, system);
  const distanceText = (distance: number): string => UNITS.displayText('distance', distance, system, 0);
  const speedText = (speed: number, digits: number): string => UNITS.displayText('windSpeed', speed, system, digits);
  const offsetText = (mil: number, distance: number, digits: number): string => UNITS.valueText('impactOffset', mil * metres(distance) * CM_PER_MIL_PER_METRE, system, digits);
  const row = (cards: CardsByCartridge | null, distance: number): DopeRow | null => exampleRow(cards, metres(distance));
  const windConstantIn = (windConstant: number): number => (system === 'imperial' ? imperialWindConstant(windConstant) : windConstant);
  const milling = () => {
    const gongSize = MILLING_EXAMPLE.gongSize[system];
    const rangeM = rangeByMilling(fromInput('targetSize', gongSize, system), MILLING_EXAMPLE.milledMil);
    return {
      gongSize: UNITS.displayText('targetSize', gongSize, system, system === 'metric' ? 1 : 0),
      gongSizeNumber: decimal(gongSize),
      factor: MILLING_FACTOR[system],
      milledMil: MILLING_EXAMPLE.milledMil,
      range: UNITS.valueText('distance', rangeM, system, 0),
    };
  };
  return {
    coldBore: () => {
      const shift = COURSE_RIFLE.coldBoreShiftMil;
      return EXAMPLE.coldBore({
        rifleName: COURSE_RIFLE.name,
        distance: distanceText(COLD_BORE_EXAMPLE_DISTANCE),
        upMil: shift.upMrad,
        up: offsetText(shift.upMrad, COLD_BORE_EXAMPLE_DISTANCE, 1),
        rightMil: shift.rightMrad,
        right: offsetText(shift.rightMrad, COLD_BORE_EXAMPLE_DISTANCE, 1),
      });
    },
    magnification: () => EXAMPLE.magnification({ magnificationMin: COURSE_SCOPE.magnificationMin, magnificationMax: COURSE_SCOPE.magnificationMax }),
    click: () =>
      EXAMPLE.click({
        correctionMil: CLICK_EXAMPLE.correctionMil,
        clickMil: CLICK_MIL,
        exactClicks: CLICK_EXAMPLE.correctionMil / CLICK_MIL,
        clicks: clickCount(CLICK_EXAMPLE.correctionMil),
        distance: distanceText(CLICK_EXAMPLE.distance),
        click: offsetText(CLICK_MIL, CLICK_EXAMPLE.distance, 0),
      }),
    turret: () => EXAMPLE.turret({ elevationTravelMil: COURSE_SCOPE.elevationTravelMrad, windageTravelMil: COURSE_SCOPE.windageTravelMrad }),
    milling: () => {
      const { gongSize, milledMil, range } = milling();
      return EXAMPLE.milling({ gongSize, milledMil, range });
    },
    mil: () =>
      EXAMPLE.mil({
        mil: MIL_EXAMPLE.mil,
        distance: distanceText(MIL_EXAMPLE.distance),
        distanceNumber: String(MIL_EXAMPLE.distance),
        divisor: MIL_SIZE_DIVISOR[system],
        size: offsetText(MIL_EXAMPLE.mil, MIL_EXAMPLE.distance, 1),
      }),
    moa: () => EXAMPLE.moa({ mil: MOA_EXAMPLE_MIL, moa: MOA_EXAMPLE_MIL / MRAD_PER_MOA, moaClickMil: MOA_SCOPE.clickMrad }),
    cartridgeCard: () => {
      const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
      return EXAMPLE.cartridgeCard({
        name: cartridge.name,
        mass: UNITS.valueText('bulletMass', cartridge.massG, system, system === 'metric' ? 1 : 0),
        velocity: velocityText(cartridge.muzzleVelocityMps, cartridge.muzzleVelocitySdMps, system),
        dragModel: cartridge.dragModel,
        ballisticCoefficient: cartridge.ballisticCoefficient,
      });
    },
    ballisticCoefficient: () =>
      EXAMPLE.ballisticCoefficient({ cartridges: EXAMPLE_CARTRIDGE_IDS.map(id => ({ name: cartridgeById(id).name, ballisticCoefficient: cartridgeById(id).ballisticCoefficient })) }),
    energy: () => {
      const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
      if (system === 'imperial') {
        const grains = toDisplay('bulletMass', cartridge.massG, system);
        const feetPerSecond = toDisplay('muzzleVelocity', cartridge.muzzleVelocityMps, system);
        const footPounds = (grains * feetPerSecond ** 2) / IMPERIAL_ENERGY_DIVISOR;
        return EXAMPLE.energy.imperial({ name: cartridge.name, mass: grains, velocity: feetPerSecond, energy: Math.round(footPounds / ENERGY_ROUNDING) * ENERGY_ROUNDING });
      }
      const massKg = cartridge.massG / GRAMS_PER_KG;
      const energyJ = (massKg * cartridge.muzzleVelocityMps ** 2) / 2;
      return EXAMPLE.energy.metric({ name: cartridge.name, mass: massKg, velocity: cartridge.muzzleVelocityMps, energy: Math.round(energyJ / ENERGY_ROUNDING) * ENERGY_ROUNDING });
    },
    velocitySpread: () => {
      const cartridge = cartridgeById(EXAMPLE_CARTRIDGE_ID);
      return EXAMPLE.velocitySpread({ name: cartridge.name, velocity: velocityText(cartridge.muzzleVelocityMps, cartridge.muzzleVelocitySdMps, system) });
    },
    dope: cards => {
      const dopeRow = row(cards, DOPE_EXAMPLE_DISTANCE);
      return dopeRow ? EXAMPLE.dope({ cartridgeName: exampleCartridgeName(), distance: distanceText(DOPE_EXAMPLE_DISTANCE), elevationMil: dopeRow.elevationMil, clicks: dopeRow.clicks }) : null;
    },
    dopeRow: cards => {
      const lower = row(cards, DOPE_ROW_EXAMPLE.lower);
      const upper = row(cards, DOPE_ROW_EXAMPLE.upper);
      const between = row(cards, DOPE_ROW_EXAMPLE.distance);
      return lower && upper && between
        ? EXAMPLE.dopeRow({
            cartridgeName: exampleCartridgeName(),
            distance: distanceText(DOPE_ROW_EXAMPLE.distance),
            lower: distanceText(DOPE_ROW_EXAMPLE.lower),
            lowerMil: lower.elevationMil,
            upper: distanceText(DOPE_ROW_EXAMPLE.upper),
            upperMil: upper.elevationMil,
            elevationMil: between.elevationMil,
            clicks: between.clicks,
          })
        : null;
    },
    timeOfFlight: cards => {
      const distanceM = metres(TIME_OF_FLIGHT_EXAMPLE_DISTANCE);
      const flightRow = exampleRow(cards, distanceM);
      return flightRow
        ? EXAMPLE.timeOfFlight({
            cartridgeName: exampleCartridgeName(),
            distance: distanceText(TIME_OF_FLIGHT_EXAMPLE_DISTANCE),
            timeOfFlightS: flightRow.timeOfFlightS,
            soundDelayS: impactSoundDelayS(flightRow.timeOfFlightS, distanceM, STANDARD_TEMPERATURE_C),
          })
        : null;
    },
    wind: cards => {
      const windRow = row(cards, WIND_EXAMPLE.distance);
      if (!windRow) {
        return null;
      }
      const speed = WIND_EXAMPLE.speed[system];
      const windConstant = windConstantIn(windRow.windConstant);
      const correctionMil = Math.abs(windCorrectionMil(speed, WIND_EXAMPLE.clockHours, WIND_EXAMPLE.distance, windConstant));
      return EXAMPLE.wind({
        speed: speedText(speed, 0),
        speedNumber: String(speed),
        clockHours: WIND_EXAMPLE.clockHours,
        distance: distanceText(WIND_EXAMPLE.distance),
        distanceNumber: String(WIND_EXAMPLE.distance),
        windConstant,
        correctionMil,
        clicks: clickCount(correctionMil),
      });
    },
    flag: () => {
      const degreesPerSpeed = FLAG_DEG_PER_MPS * fromInput('windSpeed', 1, system);
      return EXAMPLE.flag({
        angleDeg: FLAG_EXAMPLE_ANGLE_DEG,
        degPerSpeed: String(Math.round(degreesPerSpeed)),
        speed: UNITS.valueText('windSpeed', FLAG_EXAMPLE_ANGLE_DEG / FLAG_DEG_PER_MPS, system, 0),
      });
    },
    crosswind: () => {
      const speed = CROSSWIND_EXAMPLE.speed[system];
      return EXAMPLE.crosswind({
        speed: speedText(speed, 0),
        speedNumber: String(speed),
        clockHours: CROSSWIND_EXAMPLE.clockHours,
        share: windClockShare(CROSSWIND_EXAMPLE.clockHours),
        crosswind: speedText(crosswindMps(speed, CROSSWIND_EXAMPLE.clockHours), SPEED_DIGITS),
      });
    },
    clockShare: () => EXAMPLE.clockShare({ shares: CLOCK_SHARE_EXAMPLE_HOURS.map(clockHours => ({ clockHours, share: windClockShare(clockHours) })) }),
    windConstant: cards => {
      const near = row(cards, WIND_CONSTANT_EXAMPLE.near);
      const far = row(cards, WIND_CONSTANT_EXAMPLE.far);
      return near && far
        ? EXAMPLE.windConstant({
            cartridgeName: exampleCartridgeName(),
            near: distanceText(WIND_CONSTANT_EXAMPLE.near),
            nearConstant: windConstantIn(near.windConstant),
            far: distanceText(WIND_CONSTANT_EXAMPLE.far),
            farConstant: windConstantIn(far.windConstant),
          })
        : null;
    },
    windZones: cards => {
      const zonesRow = row(cards, ZONES_EXAMPLE_DISTANCE);
      return zonesRow ? EXAMPLE.windZones({ cartridgeName: exampleCartridgeName(), distance: distanceText(ZONES_EXAMPLE_DISTANCE), weights: zonesRow.zoneWeights }) : null;
    },
    averageWind: cards => {
      const zonesRow = row(cards, ZONES_EXAMPLE_DISTANCE);
      if (!zonesRow) {
        return null;
      }
      const crosswinds = ZONE_EXAMPLE_CROSSWINDS[system];
      return EXAMPLE.averageWind({
        distance: distanceText(ZONES_EXAMPLE_DISTANCE),
        crosswinds,
        speedUnit: UNITS.unitName('windSpeed', system, 0),
        weights: zonesRow.zoneWeights,
        average: speedText(averageCrosswindMps(crosswinds, zonesRow.zoneWeights), SPEED_DIGITS),
      });
    },
    milFormula: () => EXAMPLE.milFormula(milling()),
    atmosphereCorrection: cards => {
      const atmosphereRow = row(cards, ATMOSPHERE_EXAMPLE.distance);
      if (!atmosphereRow) {
        return null;
      }
      const temperature = ATMOSPHERE_EXAMPLE.temperature[system];
      const pressure = ATMOSPHERE_EXAMPLE.pressure[system];
      const isImperial = system === 'imperial';
      const correctionMil = isImperial
        ? atmosphereCorrectionMilImperial(atmosphereRow, temperature, pressure)
        : atmosphereCorrectionMil(atmosphereRow, temperature, pressure);
      return EXAMPLE.atmosphereCorrection({
        cartridgeName: exampleCartridgeName(),
        distance: distanceText(ATMOSPHERE_EXAMPLE.distance),
        temperature: UNITS.displayText('temperature', temperature, system, 0),
        pressure: UNITS.displayText('pressure', pressure, system, isImperial ? 2 : 0),
        colderTens: ((isImperial ? STANDARD_TEMPERATURE_F : STANDARD_TEMPERATURE_C) - temperature) / (isImperial ? IMPERIAL_COLDER_STEP_F : ATMOSPHERE_COLUMN_STEP),
        colderMil: atmosphereRow.colderStepMil,
        pressureTens: (pressure - (isImperial ? STANDARD_PRESSURE_INHG : STANDARD_PRESSURE_HPA)) / (isImperial ? IMPERIAL_PRESSURE_STEP_INHG : ATMOSPHERE_COLUMN_STEP),
        pressureMil: atmosphereRow.pressureStepMil,
        correctionMil,
        clicks: clickCount(correctionMil),
      });
    },
    lead: cards => {
      const leadRow = row(cards, LEAD_EXAMPLE.distance);
      if (!leadRow) {
        return null;
      }
      const speed = LEAD_EXAMPLE.targetSpeed[system];
      const isImperial = system === 'imperial';
      const params = {
        speed: speedText(speed, 1),
        speedNumber: decimal(speed, 1),
        distance: distanceText(LEAD_EXAMPLE.distance),
        distanceNumber: String(LEAD_EXAMPLE.distance),
        timeOfFlightS: leadRow.timeOfFlightS,
        leadMil: isImperial
          ? leadMilImperial(speed, LEAD_EXAMPLE.clockHours, leadRow.timeOfFlightS, LEAD_EXAMPLE.distance)
          : leadMil(speed, LEAD_EXAMPLE.clockHours, leadRow.timeOfFlightS, LEAD_EXAMPLE.distance),
      };
      return isImperial ? EXAMPLE.lead.imperial(params) : EXAMPLE.lead.metric(params);
    },
    lookAngle: () => EXAMPLE.lookAngle({ ...LOOK_ANGLE_EXAMPLE, cos: chipTrig(Math.cos, LOOK_ANGLE_EXAMPLE.upDeg) }),
    zeroAngle: cards => {
      const card = cards?.get(EXAMPLE_CARTRIDGE_ID);
      return card ? EXAMPLE.zeroAngle({ cartridgeName: exampleCartridgeName(), zero: UNITS.quantityText('distance', card.zeroM, system), zeroAngleMil: card.zeroAngleMil }) : null;
    },
    cosineRule: cards => {
      const card = cards?.get(EXAMPLE_CARTRIDGE_ID);
      if (!card) {
        return null;
      }
      const cosineRow = dopeRowAt(card, metres(COSINE_EXAMPLE.distance));
      const cos = chipTrig(Math.cos, COSINE_EXAMPLE.angleDeg);
      const inclinedMil = (cosineRow.elevationMil + card.zeroAngleMil) * cos - card.zeroAngleMil;
      return EXAMPLE.cosineRule({
        cartridgeName: exampleCartridgeName(),
        distance: distanceText(COSINE_EXAMPLE.distance),
        angleDeg: COSINE_EXAMPLE.angleDeg,
        elevationMil: cosineRow.elevationMil,
        zeroAngleMil: card.zeroAngleMil,
        cos,
        inclinedMil,
        clicks: clickCount(cosineRow.elevationMil - inclinedMil),
      });
    },
    rangeAltitude: () => {
      const highAltitude = ALTITUDE_EXAMPLE.highAltitude[system];
      const pressureDigits = system === 'imperial' ? 2 : 0;
      return EXAMPLE.rangeAltitude({
        low: UNITS.displayText('altitude', ALTITUDE_EXAMPLE.lowAltitude, system, 0),
        lowPressure: UNITS.valueText('pressure', standardPressureHpaAt(fromInput('altitude', ALTITUDE_EXAMPLE.lowAltitude, system)), system, pressureDigits),
        high: UNITS.displayText('altitude', highAltitude, system, 0),
        highPressure: UNITS.valueText('pressure', standardPressureHpaAt(fromInput('altitude', highAltitude, system)), system, pressureDigits),
      });
    },
    spinDrift: cards => {
      const spinRow = row(cards, EARTH_EXAMPLE.distance);
      return spinRow
        ? EXAMPLE.spinDrift({ cartridgeName: exampleCartridgeName(), distance: distanceText(EARTH_EXAMPLE.distance), spinDriftMil: spinRow.spinDriftMil, clicks: clickCount(spinRow.spinDriftMil) })
        : null;
    },
    twist: () => EXAMPLE.twist({ rifleName: COURSE_RIFLE.name, twistInches: COURSE_RIFLE.twistInchesPerTurn, isRight: COURSE_RIFLE.twistDirection === 'right' }),
    coriolis: cards => {
      const earthRow = row(cards, EARTH_EXAMPLE.distance);
      if (!earthRow) {
        return null;
      }
      const sinLatitude = chipTrig(Math.sin, EARTH_EXAMPLE.latitudeDeg);
      return EXAMPLE.coriolis({
        distance: distanceText(EARTH_EXAMPLE.distance),
        timeOfFlightS: earthRow.timeOfFlightS,
        latitudeDeg: EARTH_EXAMPLE.latitudeDeg,
        sinLatitude,
        coriolisMil: EARTH_ROTATION_MIL_PER_S * earthRow.timeOfFlightS * sinLatitude,
      });
    },
    eotvos: cards => {
      const earthRow = row(cards, EARTH_EXAMPLE.distance);
      if (!earthRow) {
        return null;
      }
      const cosLatitude = chipTrig(Math.cos, EARTH_EXAMPLE.latitudeDeg);
      return EXAMPLE.eotvos({
        distance: distanceText(EARTH_EXAMPLE.distance),
        latitudeDeg: EARTH_EXAMPLE.latitudeDeg,
        azimuthDeg: EARTH_EXAMPLE.azimuthDeg,
        timeOfFlightS: earthRow.timeOfFlightS,
        cosLatitude,
        eotvosMil: EARTH_ROTATION_MIL_PER_S * earthRow.timeOfFlightS * cosLatitude * chipTrig(Math.sin, EARTH_EXAMPLE.azimuthDeg),
      });
    },
    secondShotCorrection: () =>
      EXAMPLE.secondShotCorrection({
        ...SECOND_SHOT_EXAMPLE,
        windageClicks: clickCount(SECOND_SHOT_EXAMPLE.rightMil),
        elevationClicks: clickCount(SECOND_SHOT_EXAMPLE.downMil),
      }),
  };
}

function velocityText(muzzleVelocityMps: number, muzzleVelocitySdMps: number, system: UnitSystem): string {
  const velocity = toDisplay('muzzleVelocity', muzzleVelocityMps, system);
  const spread = toDisplay('muzzleVelocity', muzzleVelocitySdMps, system);
  return `${velocity} ± ${UNITS.displayText('muzzleVelocity', spread, system, 0)}`;
}

function termTextsIn(system: UnitSystem): Record<TermId, TermTexts> {
  const layout = rangeLayout(system);
  const base = T.terms({
    rifleName: COURSE_RIFLE.name,
    zero: UNITS.quantityText('distance', courseLoadout(EXAMPLE_CARTRIDGE_ID, system).rifle.zeroM, system),
    flags: UNITS.listText('distance', layout.flagDistancesM, system),
    flagsAnd: UNITS.listText('distance', layout.flagDistancesM, system, true),
  });
  if (system === 'metric') {
    return base;
  }
  const overrides = T.imperialTerms;
  return Object.fromEntries((Object.keys(base) as TermId[]).map(id => [id, { ...base[id], ...overrides[id] }])) as Record<TermId, TermTexts>;
}

function termCardsIn(system: UnitSystem): readonly TermCard[] {
  const texts = termTextsIn(system);
  const examples = examplesIn(system);
  return (Object.keys(texts) as TermId[]).map(id => {
    const example = examples[id];
    return example ? { ...texts[id], example } : texts[id];
  });
}

const TERM_CARDS_BY_SYSTEM: Record<UnitSystem, readonly TermCard[]> = {
  metric: termCardsIn('metric'),
  imperial: termCardsIn('imperial'),
};

export function termCards(system: UnitSystem): readonly TermCard[] {
  return TERM_CARDS_BY_SYSTEM[system];
}

export const TERM_CARDS: readonly TermCard[] = TERM_CARDS_BY_SYSTEM.metric;
