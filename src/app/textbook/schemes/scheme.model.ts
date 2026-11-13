import { CARTRIDGES, FLAG_DISTANCES_M, RIFLE, WIND_ZONE_LIMITS_M } from '../../../core/content';
import { decimal } from '../../../i18n/format';
import { DopeCard, dopeRowAt } from '../../../core/dope-card';
import { windClockShare } from '../../../core/field';
import { roundToClicks } from '../../../core/game-formulas';
import { CartridgeId, Correction } from '../../../core/types';
import { ReticleMark, ReticleMarkKind, reticleMarks } from '../../../sim/reticle';
import { ptPerMil, ReticleKind, reticleSubtensionScale, scopeById } from '../../../sim/scope-model';
import { analyseGroup } from '../../../sim/shot-review';
import { CardsByCartridge } from '../terms';

export type TermScheme = 'reticle' | 'focal-plane' | 'trajectory' | 'wind-clock' | 'cartridges' | 'zones' | 'group';

export const SCHEME_TERMS: Record<TermScheme, readonly string[]> = {
  reticle: ['сетка', 'MIL', 'MOA', 'миллинг'],
  'focal-plane': ['фокальная плоскость', 'кратность'],
  trajectory: ['ДОПЕ', 'строка ДОПЕ', 'ноль', 'время полёта'],
  'wind-clock': ['правило часов', 'доля по часам', 'боковая составляющая', 'ветер'],
  cartridges: ['карточка патрона', 'баллистический коэффициент', 'энергия', 'разброс скорости', 'константа ветра'],
  zones: ['зоны ветра', 'средний ветер', 'флажок'],
  group: ['группа', 'СТП', 'поправка по второму выстрелу'],
};

export const RETICLE_SCHEME_HALF_MIL = 3.5;
const RETICLE_TAP_RADIUS_MIL = 0.75;
const RETICLE_CAPTIONS: Record<Exclude<ReticleMarkKind, 'label'>, string> = {
  'mil-dot': 'точка = 1 MIL',
  'mil-tick': 'штрих = 1 MIL',
  'half-mil-tick': 'полуметка = 0,5 MIL',
  'moa-tick': 'штрих = 1 MOA = 0,29 MIL',
  'five-moa-tick': 'длинный штрих = 5 MOA',
  'holdover-dot': 'точки ёлки: ряды через 1 MIL вниз, шаг 0,5 MIL вбок',
};

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
  const isSecondPlaneTrue = magnification === SECOND_PLANE_SCOPE.magnificationMax;
  return {
    gongRadius: FOCAL_SCHEME_GONG_RADIUS_MIL * milSpacing,
    firstPlaneMilSpacing: milSpacing * reticleSubtensionScale(FIRST_PLANE_SCOPE, magnification),
    secondPlaneMilSpacing: milSpacing * secondPlaneScale,
    firstPlaneCaption: `на ${magnification}× точка = 1 MIL — верно на любой кратности`,
    secondPlaneCaption: `на ${magnification}× точка = ${decimalText(secondPlaneScale, 1)} MIL — ${isSecondPlaneTrue ? 'верно' : 'верно только на 12×'}`,
  };
}

const TIME_MARK_DISTANCES_M = [300, 600, 1000];

export interface TrajectoryView {
  points: readonly { distanceM: number; elevationMil: number }[];
  zeroM: number;
  timeMarks: readonly { distanceM: number; elevationMil: number; timeOfFlightS: number }[];
}

export function trajectoryView(card: DopeCard): TrajectoryView {
  return {
    points: card.rows.map(row => ({ distanceM: row.distanceM, elevationMil: row.elevationMil })),
    zeroM: RIFLE.zeroM,
    timeMarks: TIME_MARK_DISTANCES_M.map(distanceM => {
      const row = dopeRowAt(card, distanceM);
      return { distanceM, elevationMil: row.elevationMil, timeOfFlightS: row.timeOfFlightS };
    }),
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
    caption: `${clockHours} ч — доля ${decimalText(share, 2)}`,
  };
}

const GRAMS_PER_KG = 1000;
const ENERGY_ROUNDING_J = 10;

export interface CartridgeSchemeItem {
  id: CartridgeId;
  name: string;
  facts: readonly string[];
  drop: readonly { distanceM: number; mil: number }[];
  driftPerMps: readonly { distanceM: number; mil: number }[];
}

export function cartridgesView(cards: CardsByCartridge): readonly CartridgeSchemeItem[] {
  return CARTRIDGES.filter(cartridge => cards.has(cartridge.id)).map(cartridge => {
    const card = cards.get(cartridge.id)!;
    const energyJ = ((cartridge.massG / GRAMS_PER_KG) * cartridge.muzzleVelocityMps ** 2) / 2;
    return {
      id: cartridge.id,
      name: cartridge.name,
      facts: [
        `${decimalText(cartridge.massG, 1)} г`,
        `${cartridge.muzzleVelocityMps} м/с`,
        `BC ${decimalText(cartridge.bcG7, 3)}`,
        `${Math.round(energyJ / ENERGY_ROUNDING_J) * ENERGY_ROUNDING_J} Дж`,
      ],
      drop: card.rows.map(row => ({ distanceM: row.distanceM, mil: row.elevationMil })),
      driftPerMps: card.rows.map(row => ({ distanceM: row.distanceM, mil: row.distanceM / row.windConstant })),
    };
  });
}

export const ZONES_EXAMPLE_DISTANCE_M = 600;

export interface ZonesView {
  distanceM: number;
  zones: readonly { fromM: number; toM: number; weight: number }[];
  flagsM: readonly number[];
}

export function zonesView(card: DopeCard): ZonesView {
  const weights = dopeRowAt(card, ZONES_EXAMPLE_DISTANCE_M).zoneWeights;
  return {
    distanceM: ZONES_EXAMPLE_DISTANCE_M,
    zones: WIND_ZONE_LIMITS_M.map((untilM, index) => ({
      fromM: index === 0 ? 0 : WIND_ZONE_LIMITS_M[index - 1],
      toM: Math.min(untilM, ZONES_EXAMPLE_DISTANCE_M),
      weight: weights[index],
    })),
    flagsM: FLAG_DISTANCES_M,
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
  const center = analyseGroup(GROUP_EXAMPLE_IMPACTS)!.center;
  const upClicks = roundToClicks(-center.upMrad, GROUP_CLICK_MIL);
  const rightClicks = roundToClicks(-center.rightMrad, GROUP_CLICK_MIL);
  const offset = `${arrow(center.upMrad, '↑', '↓')} ${decimalText(Math.abs(center.upMrad), 1)} ${arrow(center.rightMrad, '→', '←')} ${decimalText(Math.abs(center.rightMrad), 1)} MIL`;
  const transfer = `${arrow(upClicks, '↑', '↓')} ${Math.abs(upClicks)} ${arrow(rightClicks, '→', '←')} ${Math.abs(rightClicks)} кл.`;
  return { impacts: GROUP_EXAMPLE_IMPACTS, center, caption: `СТП ${offset} — перенеси ${transfer}` };
}

function arrow(value: number, positive: string, negative: string): string {
  return value >= 0 ? positive : negative;
}

function decimalText(value: number, maxDigits: number): string {
  return decimal(Number(value.toFixed(maxDigits)));
}
