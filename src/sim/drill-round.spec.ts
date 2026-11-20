import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../core/content';
import { buildDopeCard, DopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { DRILL_ROUNDS_KEPT, DrillRound, drillContext, withDrillRound } from './drill-round';
import { countCard, DrillContext, TIME_LIMITS } from './drills';
import { checkInputs, placeChip, recordStep, stepSheet, typeTape } from './notebook';
import { checkManualSteps } from '../core/calc-check';
import { builtInProfile } from './rifle-profile';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const STARTED = '2026-11-20T10:00:00.000Z';
const NO_DIAL = { trueWindClock: 12, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };
let engine: BallisticsEngine;
let card: DopeCard;

beforeAll(async () => {
  engine = new BallisticsEngine();
  card = await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL, 'metric');
});

function context(): DrillContext {
  return { card, scope: scopeById('course-tree') };
}

function started(drillId: 'wind' | 'milling' | 'dope' = 'wind', seed = 4) {
  const clock = { nowS: 100 };
  const round = DrillRound.start({ drillId, seed, context: context(), startedAtIso: STARTED, clockS: () => clock.nowS });
  return { round, clock };
}

function answer(round: DrillRound, { extraClicks = 0, isSideFlipped = false } = {}): void {
  const { step, answer: reference } = round.card;
  round.stepSheet(step).slots.forEach((slot, index) => round.placeChip(step, slot.chipKind, index));
  const value = step === 'distance' ? reference.value : reference.value + extraClicks * CLICK_MIL;
  round.typeTape(step, round.stepSheet(step).tapeLength - 1, value);
  if (reference.sign !== null) {
    round.setSign(step, isSideFlipped ? (-reference.sign as 1 | -1) : reference.sign);
  }
  round.recordStep(step);
}

function playRound(round: DrillRound, clock: { nowS: number }, plan: (index: number) => Parameters<typeof answer>[1]): void {
  for (let index = 0; index < round.cards.length; index++) {
    clock.nowS += 10 + index;
    answer(round, plan(index));
    round.next();
  }
}

describe('DrillRound (T3.2)', () => {
  it('10 карточек; правка через редактор меняет блокнот текущей карточки', () => {
    const { round } = started();
    expect(round.cards).toHaveLength(10);
    expect(round.cardIndex).toBe(0);
    const before = round.notebook;
    round.typeTape(round.card.step, 0, 1.5);
    expect(round.notebook).not.toBe(before);
    expect(round.notebook.steps[round.card.step].tape[0]).toBe(1.5);
    expect(round.cards[0].notebook).toBe(before);
  });

  it('эталонный ответ → «точно»; на клик мимо → «близко»; другая сторона → «ошибка», тип «сторона»', () => {
    const exact = started().round;
    answer(exact);
    expect(exact.check?.result.verdict).toBe('exact');
    const close = started().round;
    answer(close, { extraClicks: 1 });
    expect(close.check?.result.verdict).toBe('close');
    const side = started().round;
    answer(side, { isSideFlipped: true });
    expect(side.check?.result.verdict).toBe('error');
    expect(side.check?.result.mainError?.type).toBe('side');
  });

  it('до «ЗАПИСАТЬ» вердикта нет, «ДАЛЬШЕ» не идёт; записанную карточку не переписать', () => {
    const { round } = started();
    expect(round.check).toBeNull();
    expect(round.next()).toBe(false);
    answer(round);
    const check = round.check;
    const recorded = round.notebook;
    round.typeTape(round.card.step, 0, 99);
    expect(round.notebook).toBe(recorded);
    round.recordStep(round.card.step);
    expect(round.check).toBe(check);
    expect(round.results).toHaveLength(1);
  });

  it('время карточки — от показа до «ЗАПИСАТЬ»', () => {
    const { round, clock } = started();
    clock.nowS = 112.5;
    answer(round);
    expect(round.results[0].seconds).toBe(12.5);
    expect(round.results[0].distanceM).toBe(round.card.distanceM);
    expect(round.results[0].windSpeedMps).toBe(round.card.notebook.readings.wind!.speedMps);
    round.next();
    clock.nowS = 120;
    answer(round);
    expect(round.results[1].seconds).toBe(7.5);
  });

  it('итог: точность, среднее время, ошибки по типам по убыванию', () => {
    const { round, clock } = started();
    playRound(round, clock, index => (index < 5 ? {} : index < 7 ? { extraClicks: 1 } : { isSideFlipped: true }));
    expect(round.isFinished).toBe(true);
    const summary = round.summary()!;
    expect([summary.exact, summary.close, summary.error]).toEqual([5, 2, 3]);
    expect(summary.accuracy).toBeCloseTo(0.5, 9);
    expect(summary.averageSeconds).toBeCloseTo(14.5, 9);
    expect(summary.errorCounts[0]).toEqual({ type: 'side', count: 3 });
    expect(summary.errorCounts.map(item => item.count)).toEqual([...summary.errorCounts.map(item => item.count)].sort((first, second) => second - first));
  });

  it('незаконченный раунд не даёт итога и записи', () => {
    const { round } = started();
    answer(round);
    round.next();
    expect(round.isFinished).toBe(false);
    expect(round.summary()).toBeNull();
    expect(round.toRecord()).toBeNull();
  });

  it('запись раунда: дрил, уровень learn, сид, начало, карточки', () => {
    const { round, clock } = started('milling', 9);
    playRound(round, clock, () => ({}));
    const record = round.toRecord()!;
    expect([record.drillId, record.level, record.seed, record.startedAtIso]).toEqual(['milling', 'learn', 9, STARTED]);
    expect(record.cards).toHaveLength(10);
    expect(record.cards.every(item => item.verdict === 'exact' && item.errorTypes.length === 0)).toBe(true);
  });

  it('миллинг: дальность, округлённая до метра или ярда, — «точно» при любой цене клика', async () => {
    for (const system of ['metric', 'imperial'] as const) {
      const ownContext = await drillContext(engine, builtInProfile(), system);
      const misses: number[] = [];
      for (let seed = 0; seed < 3000; seed++) {
        const millingCard = countCard('milling', seed, ownContext);
        let notebook = millingCard.notebook;
        stepSheet(notebook, 'distance').slots.forEach((slot, index) => (notebook = placeChip(notebook, 'distance', slot.chipKind, index)));
        notebook = recordStep(typeTape(notebook, 'distance', 0, Math.round(millingCard.answer.value)), 'distance');
        if (checkManualSteps(checkInputs(notebook, NO_DIAL).steps, ownContext.card.clickMil).verdict !== 'exact') {
          misses.push(seed);
        }
      }
      expect(misses, system).toEqual([]);
    }
  });
  it('тот же сид — те же карточки', () => {
    expect(started('dope', 5).round.cards).toEqual(started('dope', 5).round.cards);
    expect(started('dope', 5).round.cards).not.toEqual(started('dope', 6).round.cards);
  });
});

describe('раунд на время (T3.3, В60: 2б)', () => {
  function timed(drillId: 'wind' | 'milling' = 'wind') {
    const clock = { nowS: 100 };
    const round = DrillRound.start({ drillId, seed: 4, context: context(), startedAtIso: STARTED, clockS: () => clock.nowS, level: 'timed' });
    return { round, clock };
  }

  function answerOnly(round: DrillRound, value: number): void {
    const { step, answer: reference } = round.card;
    round.typeTape(step, round.stepSheet(step).tapeLength - 1, value);
    if (reference.sign !== null) {
      round.setSign(step, reference.sign);
    }
    round.recordStep(step);
  }

  it('фишки уже в слотах: игрок пишет только число и сторону — «точно»', () => {
    const { round } = timed();
    expect(round.stepSheet(round.card.step).slots.every(slot => slot.placed !== null)).toBe(true);
    answerOnly(round, round.card.answer.value);
    expect(round.check?.result.verdict).toBe('exact');
    expect(round.level).toBe('timed');
  });

  it(`отсчёт ${TIME_LIMITS.cardS} с; время вышло — карточка «время», без вердикта листа; ДАЛЬШЕ идёт`, () => {
    const { round, clock } = timed();
    expect(round.timeLeftS()).toBe(TIME_LIMITS.cardS);
    clock.nowS += 12;
    expect(round.timeLeftS()).toBe(TIME_LIMITS.cardS - 12);
    expect(round.expireIfLate()).toBe(false);
    clock.nowS += TIME_LIMITS.cardS;
    expect(round.expireIfLate()).toBe(true);
    expect(round.isTimedOut).toBe(true);
    expect(round.results[0]).toMatchObject({ verdict: 'error', errorTypes: [], seconds: TIME_LIMITS.cardS, isTimedOut: true });
    answerOnly(round, round.card.answer.value);
    expect(round.results).toHaveLength(1);
    expect(round.next()).toBe(true);
    expect(round.isTimedOut).toBe(false);
    expect(round.timeLeftS()).toBe(TIME_LIMITS.cardS);
  });

  it('записанная вовремя карточка не истекает; в учёбе отсчёта нет', () => {
    const { round, clock } = timed();
    answerOnly(round, round.card.answer.value);
    clock.nowS += 60;
    expect(round.expireIfLate()).toBe(false);
    expect(round.results[0].isTimedOut).toBeUndefined();
    const learn = started().round;
    expect(learn.timeLeftS()).toBeNull();
    expect(learn.expireIfLate()).toBe(false);
  });
});

describe('винтовка дрила', () => {
  it('без активного профиля — винтовка и прицел курса; с профилем — его прицел и цена клика', async () => {
    const course = await drillContext(engine, null, 'metric');
    expect(course.scope.id).toBe('course-tree');
    expect(course.card.cartridgeId).toBe(courseLoadout('B').cartridge.id);
    const profile = builtInProfile();
    const own = await drillContext(engine, profile, 'imperial');
    expect(own.scope.id).toBe(profile.id);
    expect(own.card.system).toBe('imperial');
    expect(own.card.clickMil).toBeCloseTo(own.scope.clickMrad, 9);
  });
});

describe('хранение раундов', () => {
  it(`новый раунд — в конец; хранятся последние ${DRILL_ROUNDS_KEPT}`, () => {
    const round = { drillId: 'wind' as const, level: 'learn' as const, seed: 1, startedAtIso: STARTED, cards: [] };
    const full = Array.from({ length: DRILL_ROUNDS_KEPT }, (_, seed) => ({ ...round, seed }));
    const next = withDrillRound(full, { ...round, seed: -1 });
    expect(next).toHaveLength(DRILL_ROUNDS_KEPT);
    expect(next[next.length - 1].seed).toBe(-1);
    expect(next[0].seed).toBe(1);
  });
});
