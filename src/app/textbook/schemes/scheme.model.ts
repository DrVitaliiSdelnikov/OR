import { CARTRIDGES, COURSE_RIFLE, rangeLayout } from '../../../core/content';
import { fromInput, toDisplay, UnitSystem } from '../../../core/units';
import { text } from '../../../i18n';
import { DopeCard, dopeRowAt } from '../../../core/dope-card';
import { windClockShare } from '../../../core/field';
import { roundToClicks } from '../../../core/game-formulas';
import { CartridgeId, Correction } from '../../../core/types';
import { ReticleMark, ReticleMarkKind, reticleMarks } from '../../../sim/reticle';
import { ptPerMil, ReticleKind, reticleSubtensionScale, scopeById } from '../../../sim/scope-model';
import { analyseGroup } from '../../../sim/shot-review';
import { CardsByCartridge } from '../terms';

export type TermScheme = 'reticle' | 'focal-plane' | 'trajectory' | 'wind-clock' | 'cartridges' | 'zones' | 'group';

const T = text.textbook.schemes;
const UNITS = text.units;

export const SCHEME_TERMS: Record<TermScheme, readonly string[]> = text.textbook.schemeTerms;

export const RETICLE_SCHEME_HALF_MIL = 3.5;
const RETICLE_TAP_RADIUS_MIL = 0.75;
const RETICLE_CAPTIONS: Record<Exclude<ReticleMarkKind, 'label'>, string> = T.reticleCaptions;

export interface TappedReticleMark extends ReticleMark {
  caption: string;
}

export function schemeOf(term: string): TermScheme | null {
  const entry = Object.entries(SCHEME_TERMS).find(([, terms]) => terms.includes(term));
  return entry ? (entry[0] as TermScheme) : null;
}

export function reticleSchemeMarks(kind: ReticleKind): readonly ReticleMark[] {
  return reticleMarks(kind).marks.filter(mark => Math.hypot(mark.rightMil, mark.downMil) <= RETICLE_SCHEME_HALF_MIL);
}

export function nearestReticleMark(kind: ReticleKind, rightMil: number, downMil: number): TappedReticleMark | null {
  let nearest: ReticleMark | null = null;
  let nearestDistanceMil = RETICLE_TAP_RADIUS_MIL;
  for (const mark of reticleSchemeMarks(kind)) {
    const distanceMil = Math.hypot(mark.rightMil - rightMil, mark.downMil - downMil);
    if (mark.kind !== 'label' && distanceMil <= nearestDistanceMil) {
      nearest = mark;
      nearestDistanceMil = distanceMil;
    }
  }
  return nearest && nearest.kind !== 'label' ? { ...nearest, caption: RETICLE_CAPTIONS[nearest.kind] } : null;
}

const FOCAL_SCHEME_MAGNIFICATION = 12;
const FOCAL_SCHEME_MIL_AT_FULL_ZOOM = 12;
const FOCAL_SCHEME_GONG_RADIUS_MIL = 1;
const FIRST_PLANE_SCOPE = scopeById('course-dot');
const SECOND_PLANE_SCOPE = scopeById('dot');

export interface FocalPlaneView {
  gongRadius: number;
  firstPlaneMilSpacing: number;
  secondPlaneMilSpacing: number;
  firstPlaneCaption: string;
  secondPlaneCaption: string;
}

export function focalPlaneView(magnification: number): FocalPlaneView {
  const milSpacing = (FOCAL_SCHEME_MIL_AT_FULL_ZOOM * ptPerMil(magnification)) / ptPerMil(FOCAL_SCHEME_MAGNIFICATION);
  const secondPlaneScale = reticleSubtensionScale(SECOND_PLANE_SCOPE, magnification);
  return {
    gongRadius: FOCAL_SCHEME_GONG_RADIUS_MIL * milSpacing,
    firstPlaneMilSpacing: milSpacing * reticleSubtensionScale(FIRST_PLANE_SCOPE, magnification),
    secondPlaneMilSpacing: milSpacing * secondPlaneScale,
    firstPlaneCaption: T.firstPlaneCaption({ magnification }),
    secondPlaneCaption: T.secondPlaneCaption({ magnification, dotMil: secondPlaneScale, trueMagnification: SECOND_PLANE_SCOPE.magnificationMax }),
  };
}

const TIME_MARK_DISTANCES = [300, 600, 1000];
const TRAJECTORY_TICKS = [0, 500, 1000];
const SCHEME_MAX_DISTANCE = 1000;

export interface TrajectoryLabels {
  zero: string;
  ticks: readonly { distanceM: number; text: string }[];
  maxDistanceM: number;
  maxElevation: string;
}

export interface TrajectoryView {
  points: readonly { distanceM: number; elevationMil: number }[];
  zeroM: number;
  timeMarks: readonly { distanceM: number; elevationMil: number; timeOfFlightS: number }[];
  labels: TrajectoryLabels;
}

const metresIn = (system: UnitSystem) => (distance: number): number => fromInput('distance', distance, system);
const distanceTextIn = (system: UnitSystem) => (distance: number): string => UNITS.displayText('distance', distance, system, 0);

export function trajectoryView(card: DopeCard): TrajectoryView {
  const metres = metresIn(card.system);
  const distanceText = distanceTextIn(card.system);
  const maxMil = Math.max(...card.rows.map(row => row.elevationMil));
  return {
    points: card.rows.map(row => ({ distanceM: row.distanceM, elevationMil: row.elevationMil })),
    zeroM: card.zeroM,
    timeMarks: TIME_MARK_DISTANCES.map(distance => {
      const row = dopeRowAt(card, metres(distance));
      return { distanceM: metres(distance), elevationMil: row.elevationMil, timeOfFlightS: row.timeOfFlightS };
    }),
    labels: {
      zero: T.trajectory.zero({ zero: UNITS.quantityText('distance', card.zeroM, card.system) }),
      ticks: TRAJECTORY_TICKS.map(distance => ({ distanceM: metres(distance), text: distanceText(distance) })),
      maxDistanceM: metres(SCHEME_MAX_DISTANCE),
      maxElevation: T.trajectory.maxElevation({ distance: distanceText(SCHEME_MAX_DISTANCE), maxMil }),
    },
  };
}

const DEGREES_PER_CLOCK_HOUR = 30;

export interface WindClockView {
  clockHours: number;
  share: number;
  arrowFromDeg: number;
  caption: string;
}

export function windClockView(clockHours: number): WindClockView {
  const share = windClockShare(clockHours);
  return {
    clockHours,
    share,
    arrowFromDeg: (clockHours * DEGREES_PER_CLOCK_HOUR) % 360,
    caption: T.windClockCaption({ clockHours, share }),
  };
}

const GRAMS_PER_KG = 1000;
const ENERGY_ROUNDING = 10;
const IMPERIAL_ENERGY_DIVISOR = 450240;
const ONE_WIND_UNIT = 1;

export interface CartridgeSchemeItem {
  id: CartridgeId;
  name: string;
  facts: readonly string[];
  drop: readonly { distanceM: number; mil: number }[];
  driftPerWindUnit: readonly { distanceM: number; mil: number }[];
}

export interface CartridgesLabels {
  driftTitle: string;
  maxDistanceM: number;
  axis: (maxMil: number) => string;
}

export function cardsSystem(cards: CardsByCartridge): UnitSystem {
  return [...cards.values()][0]?.system ?? 'metric';
}

export function cartridgesLabels(system: UnitSystem): CartridgesLabels {
  return {
    driftTitle: T.cartridges.driftTitle({ speed: UNITS.displayText('windSpeed', ONE_WIND_UNIT, system, 0) }),
    maxDistanceM: metresIn(system)(SCHEME_MAX_DISTANCE),
    axis: maxMil => T.cartridges.axis({ distance: distanceTextIn(system)(SCHEME_MAX_DISTANCE), maxMil }),
  };
}

function energyText(massG: number, muzzleVelocityMps: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const footPounds = (toDisplay('bulletMass', massG, system) * toDisplay('muzzleVelocity', muzzleVelocityMps, system) ** 2) / IMPERIAL_ENERGY_DIVISOR;
    return T.energy.imperial({ energy: Math.round(footPounds / ENERGY_ROUNDING) * ENERGY_ROUNDING });
  }
  const energyJ = ((massG / GRAMS_PER_KG) * muzzleVelocityMps ** 2) / 2;
  return T.energy.metric({ energy: Math.round(energyJ / ENERGY_ROUNDING) * ENERGY_ROUNDING });
}

export function cartridgesView(cards: CardsByCartridge): readonly CartridgeSchemeItem[] {
  return CARTRIDGES.filter(cartridge => cards.has(cartridge.id)).map(cartridge => {
    const card = cards.get(cartridge.id)!;
    const windUnitMps = fromInput('windSpeed', ONE_WIND_UNIT, card.system);
    return {
      id: cartridge.id,
      name: cartridge.name,
      facts: T.cartridgeFacts({
        mass: UNITS.quantityText('bulletMass', cartridge.massG, card.system),
        velocity: UNITS.quantityText('muzzleVelocity', cartridge.muzzleVelocityMps, card.system),
        ballisticCoefficient: cartridge.ballisticCoefficient,
        energy: energyText(cartridge.massG, cartridge.muzzleVelocityMps, card.system),
      }),
      drop: card.rows.map(row => ({ distanceM: row.distanceM, mil: row.elevationMil })),
      driftPerWindUnit: card.rows.map(row => ({ distanceM: row.distanceM, mil: (row.distanceM / row.windConstant) * windUnitMps })),
    };
  });
}

const ZONES_EXAMPLE_DISTANCE = 600;

export interface ZonesView {
  distanceM: number;
  zones: readonly { fromM: number; toM: number; weight: number }[];
  flags: readonly { distanceM: number; text: string }[];
  caption: string;
}

export function zonesView(card: DopeCard): ZonesView {
  const distanceM = metresIn(card.system)(ZONES_EXAMPLE_DISTANCE);
  const layout = rangeLayout(card.system);
  const weights = dopeRowAt(card, distanceM).zoneWeights;
  return {
    distanceM,
    zones: layout.windZoneLimitsM.map((untilM, index) => ({
      fromM: index === 0 ? 0 : layout.windZoneLimitsM[index - 1],
      toM: Math.min(untilM, distanceM),
      weight: weights[index],
    })),
    flags: layout.flagDistancesM.map(flagDistanceM => ({ distanceM: flagDistanceM, text: UNITS.numberText('distance', flagDistanceM, card.system, 0) })),
    caption: T.zones.caption({ distance: distanceTextIn(card.system)(ZONES_EXAMPLE_DISTANCE), lastStretch: T.zones.lastStretch[card.system] }),
  };
}

export const GROUP_EXAMPLE_IMPACTS: readonly Correction[] = [
  { upMrad: -0.6, rightMrad: 0.6 },
  { upMrad: -1, rightMrad: 0.4 },
  { upMrad: -0.8, rightMrad: 0.3 },
  { upMrad: -0.7, rightMrad: 0.7 },
  { upMrad: -0.9, rightMrad: 0.5 },
];
export const GROUP_EXAMPLE_RADIUS_MIL = 1;
const GROUP_CLICK_MIL = 0.1;

export interface GroupView {
  impacts: readonly Correction[];
  center: Correction;
  caption: string;
}

export function groupView(): GroupView {
  const center = analyseGroup(GROUP_EXAMPLE_IMPACTS, COURSE_RIFLE.groupSigmaMrad)!.center;
  const upClicks = roundToClicks(-center.upMrad, GROUP_CLICK_MIL);
  const rightClicks = roundToClicks(-center.rightMrad, GROUP_CLICK_MIL);
  return { impacts: GROUP_EXAMPLE_IMPACTS, center, caption: T.groupCaption({ upMil: center.upMrad, rightMil: center.rightMrad, upClicks, rightClicks }) };
}
