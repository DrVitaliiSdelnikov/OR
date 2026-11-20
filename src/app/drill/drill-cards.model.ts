import { displayDigits, Quantity, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { isTimedOpen } from '../../sim/drill-levels';
import { DrillErrorKind, DrillRoundRecord, DrillRoundSummary } from '../../sim/drill-round';
import { COUNT_DRILL_IDS, CountCard, DrillId, drillById, DrillLevel, drillTitle, POSITION_DRILL_IDS } from '../../sim/drills';
import { MAIN_CAUSE_PHRASES } from '../result/result.model';
import { targetSizeText } from '../notebook/calc-sheet.model';

const T = text.drills;
export const POSITION_DRILL_PREFIX = 'drill-';
const MISS_PREFIX = 'miss-';

export interface DrillListRow {
  id: DrillId;
  title: string;
  skill: string;
  taughtIn: string | null;
  timed: { isOpen: boolean; label: string };
}

export interface DrillListGroup {
  title: string;
  rows: DrillListRow[];
}

export interface DrillLink {
  path: string[];
  query: Record<string, string>;
}

export interface SummaryView {
  counts: string;
  accuracy: string;
  averageTime: string;
  errors: string[];
}

export function drillListGroups(rounds: readonly DrillRoundRecord[], isEverythingUnlocked: boolean): DrillListGroup[] {
  const rowOf = (id: DrillId): DrillListRow => {
    const drill = drillById(id)!;
    const isOpen = isTimedOpen(id, rounds, isEverythingUnlocked);
    return {
      id,
      title: drillTitle(id),
      skill: T.skills[drill.skill],
      taughtIn: drill.taughtIn ? T.taughtIn({ exerciseId: drill.taughtIn }) : null,
      timed: { isOpen, label: isOpen ? T.list.timed : T.list.timedLocked },
    };
  };
  return [
    { title: T.list.countGroup, rows: COUNT_DRILL_IDS.map(rowOf) },
    { title: T.list.positionGroup, rows: POSITION_DRILL_IDS.map(rowOf) },
  ];
}

export function drillLink(id: DrillId, level: DrillLevel): DrillLink {
  const query: Record<string, string> = level === 'timed' ? { level } : {};
  return drillById(id)!.kind === 'count' ? { path: ['/drill', id], query } : { path: ['/position', `${POSITION_DRILL_PREFIX}${id}`], query };
}

export function conditionsText(card: CountCard): string {
  const { context, readings, distanceM } = card.notebook;
  const system = context.card.system;
  const value = (quantity: Quantity, baseValue: number) => valueText(quantity, baseValue, system);
  const distance = value('distance', distanceM ?? 0);
  switch (card.drillId) {
    case 'milling':
      return T.conditions.milling({ size: targetSizeText(context.target.sizeM, system), reticleMil: readings.reticleMil ?? 0 });
    case 'dope':
      return distance;
    case 'wind':
      return T.conditions.wind({ speed: value('windSpeed', readings.wind?.speedMps ?? 0), clock: readings.wind?.clock ?? 0, distance });
    case 'conditions':
      return T.conditions.conditions({ temperature: value('temperature', readings.station?.temperatureC ?? 0), pressure: value('pressure', readings.station?.pressureHpa ?? 0), distance });
    case 'angle':
      return T.conditions.angle({ lookAngleDeg: context.geometry?.lookAngleDeg ?? 0, distance });
    case 'lead':
      return T.conditions.lead({ speed: value('windSpeed', context.target.movement?.speedMps ?? 0), clock: context.target.movement?.clock ?? 0, distance });
  }
}

export function summaryView(summary: DrillRoundSummary): SummaryView {
  return {
    counts: T.summary.counts(summary),
    accuracy: T.summary.accuracy({ share: summary.accuracy }),
    averageTime: T.summary.averageTime({ seconds: summary.averageSeconds }),
    errors: errorsOf(summary),
  };
}

export function positionSummaryView(summary: DrillRoundSummary): SummaryView {
  const shots = summary.exact + summary.close + summary.error;
  return {
    counts: T.summary.hits({ hits: summary.exact, shots }),
    accuracy: T.summary.accuracy({ share: summary.accuracy }),
    averageTime: T.summary.averageShotTime({ seconds: summary.averageSeconds }),
    errors: errorsOf(summary),
  };
}

function errorsOf(summary: DrillRoundSummary): string[] {
  return summary.errorCounts.map(item => T.summary.error({ label: errorLabel(item.type), count: item.count }));
}

function errorLabel(kind: DrillErrorKind): string {
  if (kind === 'time') {
    return T.summary.time;
  }
  if (kind.startsWith(MISS_PREFIX)) {
    return MAIN_CAUSE_PHRASES[kind.slice(MISS_PREFIX.length) as keyof typeof MAIN_CAUSE_PHRASES];
  }
  return text.review.errorLabels[kind as keyof typeof text.review.errorLabels];
}

function valueText(quantity: Quantity, baseValue: number, system: UnitSystem): string {
  return text.units.valueText(quantity, baseValue, system, displayDigits(quantity, system));
}
