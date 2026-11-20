import { displayDigits, Quantity, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { DrillRoundSummary } from '../../sim/drill-round';
import { COUNT_DRILL_IDS, CountCard, CountDrillId, drillById, drillTitle } from '../../sim/drills';
import { targetSizeText } from '../notebook/calc-sheet.model';

const T = text.drills;

export interface DrillListRow {
  id: CountDrillId;
  title: string;
  skill: string;
  taughtIn: string | null;
}

export interface SummaryView {
  counts: string;
  accuracy: string;
  averageTime: string;
  errors: string[];
}

export function drillListRows(): DrillListRow[] {
  return COUNT_DRILL_IDS.map(id => {
    const drill = drillById(id)!;
    return { id, title: drillTitle(id), skill: T.skills[drill.skill], taughtIn: drill.taughtIn ? T.taughtIn({ exerciseId: drill.taughtIn }) : null };
  });
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
    errors: summary.errorCounts.map(item => T.summary.error({ label: text.review.errorLabels[item.type], count: item.count })),
  };
}

function valueText(quantity: Quantity, baseValue: number, system: UnitSystem): string {
  return text.units.valueText(quantity, baseValue, system, displayDigits(quantity, system));
}
