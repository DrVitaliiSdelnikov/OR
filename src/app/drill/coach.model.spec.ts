import { describe, expect, it } from 'vitest';
import { CoachAdvice } from '../../sim/coach';
import { DrillRoundRecord } from '../../sim/drill-round';
import { JournalSeries, JournalShot } from '../journal/journal.model';
import { coachView, skillPractices } from './coach.model';

const STARTED = '2026-11-20T10:00:00.000Z';

function journalShot(fields: Partial<JournalShot> = {}): JournalShot {
  return { distanceM: 600, isHit: false, isFirstAtTarget: true, mainCause: null, errorTypes: ['side'], windSpeedMps: 4, mode: 'auto', causes: [{ kind: 'wind-clock', mil: 0.5 }], clickMil: 0.1, ...fields };
}

function series(shots: JournalShot[]): JournalSeries {
  return { id: 's1', startedAtIso: STARTED, kind: 'free', exerciseId: null, title: 'Свободная', mode: 'auto', cartridgeIds: ['B'], exerciseClass: null, total: null, isInterrupted: false, shots };
}

function round(fields: Partial<DrillRoundRecord>): DrillRoundRecord {
  return { drillId: 'wind', level: 'learn', seed: 1, startedAtIso: STARTED, cards: [], ...fields };
}

describe('занятия навыков', () => {
  it('выстрел журнала: попытки навыков, неудача — исход 0, без типов ошибок', () => {
    expect(skillPractices([series([journalShot()])], [])).toEqual([
      { skill: 'wind', atIso: STARTED, isFailure: true, errorTypes: [] },
      { skill: 'execution', atIso: STARTED, isFailure: false, errorTypes: [] },
    ]);
  });

  it('карточка: навык дрила, неудача — ошибка или время вышло, типы карточки; на время — ещё «скорость»', () => {
    const cards: DrillRoundRecord['cards'] = [
      { verdict: 'close', errorTypes: ['rounding'], seconds: 9 },
      { verdict: 'error', errorTypes: ['side'], seconds: 9 },
      { verdict: 'close', errorTypes: [], seconds: 30, isTimedOut: true },
    ];
    expect(skillPractices([], [round({ cards })]).map(item => [item.skill, item.isFailure, item.errorTypes])).toEqual([
      ['wind', false, ['rounding']],
      ['wind', true, ['side']],
      ['wind', true, []],
    ]);
    expect(skillPractices([], [round({ cards, level: 'timed' })]).filter(item => item.skill === 'speed').map(item => [item.isFailure, item.errorTypes])).toEqual([
      [false, []],
      [true, []],
      [true, []],
    ]);
  });

  it('раунд на позиции: одно занятие навыка дрила без неудачи; на время — «скорость» из попыток', () => {
    const cards: DrillRoundRecord['cards'] = [
      { verdict: 'error', errorTypes: [], seconds: 40, missCause: 'hold' },
      { verdict: 'error', errorTypes: [], seconds: 90, isTimedOut: true },
    ];
    expect(skillPractices([], [round({ drillId: 'wind-bracket', cards })])).toEqual([{ skill: 'wind', atIso: STARTED, isFailure: false, errorTypes: [] }]);
    expect(skillPractices([], [round({ drillId: 'wind-bracket', level: 'timed', cards })]).map(item => [item.skill, item.isFailure])).toEqual([
      ['wind', false],
      ['speed', false],
      ['speed', true],
    ]);
  });

  it('этап на время на обучении — занятие «скорости», хотя рейтинг её не оценивает', () => {
    expect(skillPractices([], [round({ drillId: 'timed-stage', cards: [{ verdict: 'exact', errorTypes: [], seconds: 20 }] })]).map(item => item.skill)).toEqual(['speed']);
  });
});

describe('вид совета', () => {
  const advice = (fields: Partial<CoachAdvice>): CoachAdvice => ({ skill: 'wind', drillId: 'wind', level: 'learn', priority: 1, reason: { kind: 'never' }, ...fields });

  it('заголовок, дрил с уровнем, ссылка', () => {
    expect(coachView(advice({}))).toEqual({ title: 'Тренер: ветер', drill: 'Ветер · обучение', reason: 'ещё не тренировали', link: { path: ['/drill', 'wind'], query: {} } });
    expect(coachView(advice({ skill: 'speed', drillId: 'timed-stage', level: 'timed' }))).toMatchObject({ drill: 'Этап на время · на время', link: { path: ['/position', 'drill-timed-stage'], query: { level: 'timed' } } });
  });

  it('причины: ошибки с типом и без, давно, рейтинг', () => {
    const reasonOf = (reason: CoachAdvice['reason']) => coachView(advice({ reason })).reason;
    expect(reasonOf({ kind: 'errors', count: 3, topError: 'side' })).toBe('3 ошибки за неделю, чаще СТОРОНА');
    expect(reasonOf({ kind: 'errors', count: 5, topError: null })).toBe('5 ошибок за неделю');
    expect(reasonOf({ kind: 'stale', days: 9 })).toBe('не тренировали 9 дней');
    expect(reasonOf({ kind: 'stale', days: 21 })).toBe('не тренировали 21 день');
    expect(reasonOf({ kind: 'weak', rating: 33 })).toBe('рейтинг 33 из 100');
  });
});
