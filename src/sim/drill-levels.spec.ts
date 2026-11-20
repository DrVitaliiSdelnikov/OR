import { describe, expect, it } from 'vitest';
import { ExerciseShotRecord, setupTask } from './course';
import { DrillCardResult, DrillRoundRecord } from './drill-round';
import { drillRoundSummary, isTimedOpen, positionDrillRecord } from './drill-levels';
import { positionDrillTask, positionTimeLimit, TIME_LIMITS } from './drills';

const STARTED = '2026-11-20T10:00:00.000Z';

function round(drillId: DrillRoundRecord['drillId'], exact: number, level: DrillRoundRecord['level'] = 'learn'): DrillRoundRecord {
  const cards: DrillCardResult[] = Array.from({ length: 10 }, (_, index) => ({ verdict: index < exact ? 'exact' : 'error', errorTypes: [], seconds: 10 }));
  return { drillId, level, seed: 1, startedAtIso: STARTED, cards };
}

function shot(fields: Partial<ExerciseShotRecord>): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM: 300, isHit: true, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean', ...fields };
}

describe('уровень «на время» открывается (В60: 1а)', () => {
  it('два последних раунда учёбы ≥ 80 % — открыт', () => {
    expect(isTimedOpen('wind', [round('wind', 8), round('wind', 9)], false)).toBe(true);
  });

  it('один раунд, 79 % или раунд другого дрила — закрыт', () => {
    expect(isTimedOpen('wind', [round('wind', 9)], false)).toBe(false);
    expect(isTimedOpen('wind', [round('wind', 9), round('wind', 7)], false)).toBe(false);
    expect(isTimedOpen('wind', [round('wind', 9), round('milling', 10)], false)).toBe(false);
  });

  it('считаются последние два раунда учёбы; раунды на время не мешают', () => {
    expect(isTimedOpen('wind', [round('wind', 2), round('wind', 9), round('wind', 9), round('wind', 1, 'timed')], false)).toBe(true);
    expect(isTimedOpen('wind', [round('wind', 9), round('wind', 9), round('wind', 2)], false)).toBe(false);
  });

  it('«Открыть всё» открывает сразу', () => {
    expect(isTimedOpen('patrol', [], true)).toBe(true);
  });
});

describe('итог раунда', () => {
  it('время вышло и причины промахов — в ошибках, по убыванию', () => {
    const summary = drillRoundSummary([
      { verdict: 'exact', errorTypes: [], seconds: 10 },
      { verdict: 'error', errorTypes: [], seconds: 30, isTimedOut: true },
      { verdict: 'error', errorTypes: [], seconds: 30, isTimedOut: true },
      { verdict: 'error', errorTypes: [], seconds: 20, missCause: 'hold' },
    ]);
    expect([summary.exact, summary.error, summary.accuracy, summary.averageSeconds]).toEqual([1, 3, 0.25, 22.5]);
    expect(summary.errorCounts).toEqual([
      { type: 'time', count: 2 },
      { type: 'miss-hold', count: 1 },
    ]);
  });
});

describe('раунд дрила на позиции', () => {
  it('выстрел = карточка: попадание — «точно», промах — «ошибка» с причиной, время — время выстрела', () => {
    const record = positionDrillRecord({
      drillId: 'distance-ladder',
      level: 'learn',
      seed: 7,
      startedAtIso: STARTED,
      records: [shot({ shotSeconds: 12 }), shot({ isHit: false, mainCause: 'wind-under', shotSeconds: 20 }), shot({ isHit: false, isTimedOut: true, shotSeconds: 90 })],
    });
    expect([record.drillId, record.level, record.seed, record.startedAtIso]).toEqual(['distance-ladder', 'learn', 7, STARTED]);
    expect(record.cards).toEqual([
      { verdict: 'exact', errorTypes: [], seconds: 12 },
      { verdict: 'error', errorTypes: [], seconds: 20, missCause: 'wind-under' },
      { verdict: 'error', errorTypes: [], seconds: 90, isTimedOut: true },
    ]);
  });
});

describe('задача дрила на позиции', () => {
  it('несёт метку дрила и уровня; план огня — этапный, а не бесконечный', () => {
    const task = positionDrillTask('distance-ladder', 'metric', null, 'timed');
    expect(task.drill).toEqual({ id: 'distance-ladder', level: 'timed' });
    const plan = setupTask(task, 4).plan;
    expect(plan.kind).toBe('exercise');
    expect(positionDrillTask('cold-bore', 'metric').drill).toEqual({ id: 'cold-bore', level: 'learn' });
  });

  it('лимиты: учёба — без; на время — 90 с на выстрел; этап на время — 120 с на этап', () => {
    expect(positionTimeLimit(positionDrillTask('patrol', 'metric'))).toBeNull();
    expect(positionTimeLimit(positionDrillTask('patrol', 'metric', null, 'timed'))).toEqual({ scope: 'shot', seconds: TIME_LIMITS.shotS });
    expect(positionTimeLimit(positionDrillTask('timed-stage', 'metric', null, 'timed'))).toEqual({ scope: 'stage', seconds: TIME_LIMITS.stageS });
    expect([TIME_LIMITS.cardS, TIME_LIMITS.shotS, TIME_LIMITS.stageS]).toEqual([30, 90, 120]);
  });
});
