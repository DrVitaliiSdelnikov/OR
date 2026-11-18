import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps } from '../core/calc-check';
import { courseLoadout } from '../core/content';
import { buildDopeCard, DopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { UnitSystem } from '../core/units';
import { COURSE, setupTask } from './course';
import { COUNT_DRILL_IDS, CountCard, countCard, CountDrillDef, countRound, DRILLS, drillById, POSITION_DRILL_IDS, positionDrillTask } from './drills';
import { checkInputs, placeChip, recordStep, setSign, stepSheet, typeTape } from './notebook';
import { builtInProfile, loadoutOf } from './rifle-profile';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const SYSTEMS: readonly UnitSystem[] = ['metric', 'imperial'];
const cards = new Map<UnitSystem, DopeCard>();
const scope = scopeById('tree');

beforeAll(async () => {
  const engine = new BallisticsEngine();
  for (const system of SYSTEMS) {
    cards.set(system, await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL, system));
  }
});

function drillContext(system: UnitSystem) {
  return { card: cards.get(system)!, scope };
}

function solved(card: CountCard, extraClicks = 0) {
  let notebook = card.notebook;
  stepSheet(notebook, card.step).slots.forEach((slot, index) => {
    notebook = placeChip(notebook, card.step, slot.chipKind, index);
  });
  const value = card.step === 'distance' ? card.answer.value : card.answer.value + extraClicks * CLICK_MIL;
  notebook = typeTape(notebook, card.step, stepSheet(notebook, card.step).tapeLength - 1, value);
  if (card.answer.sign !== null) {
    notebook = setSign(notebook, card.step, card.answer.sign);
  }
  notebook = recordStep(notebook, card.step);
  const truth = { trueWindClock: 3, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };
  return checkManualSteps(checkInputs(notebook, truth).steps, CLICK_MIL);
}

describe('каталог дрилов (T3.1)', () => {
  it('6 счётных и 5 на позиции; у каждого навык и уровни learn / timed', () => {
    expect(DRILLS.filter(drill => drill.kind === 'count').map(drill => drill.id)).toEqual(COUNT_DRILL_IDS);
    expect(DRILLS.filter(drill => drill.kind === 'position').map(drill => drill.id)).toEqual(POSITION_DRILL_IDS);
    expect([COUNT_DRILL_IDS.length, POSITION_DRILL_IDS.length]).toEqual([6, 5]);
    for (const drill of DRILLS) {
      expect(drill.skill, drill.id).toBeTruthy();
      expect(drill.levels, drill.id).toEqual(['learn', 'timed']);
    }
  });

  it('В57: все открыты; «учат в упражнении» — существующее упражнение курса или нет', () => {
    const ids = COURSE.map(def => def.id);
    for (const drill of DRILLS) {
      expect(drill.taughtIn === null || ids.includes(drill.taughtIn), drill.id).toBe(true);
    }
    expect(drillById('milling')!.taughtIn).toBe('05');
    expect(drillById('lead')!.taughtIn).toBe('11');
  });
});

describe('счётные карточки (T3.1)', () => {
  it('один сид — одна карточка; разные сиды — разные числа', () => {
    for (const id of COUNT_DRILL_IDS) {
      const context = drillContext('metric');
      expect(countCard(id, 7, context), id).toEqual(countCard(id, 7, context));
      const answers = new Set(Array.from({ length: 10 }, (_, seed) => countCard(id, seed, context).answer.value));
      expect(answers.size, id).toBeGreaterThan(1);
    }
  });

  it('раунд — 10 карточек, повторяемый по сиду', () => {
    const round = countRound('wind', 3, drillContext('metric'));
    expect(round).toHaveLength(10);
    expect(round).toEqual(countRound('wind', 3, drillContext('metric')));
    expect(new Set(round.map(card => card.answer.value)).size).toBeGreaterThan(1);
  });

  it('ответ карточки — эталон шага листа САМ: записан ответ → «точно», на 3 клика мимо → не «точно»; метрика и ярды', () => {
    for (const system of SYSTEMS) {
      for (const id of COUNT_DRILL_IDS) {
        for (const seed of [1, 2, 3]) {
          const card = countCard(id, seed, drillContext(system));
          const label = `${system}/${id}/${seed}`;
          expect(card.step, label).toBe((drillById(id) as CountDrillDef).step);
          expect(solved(card).verdict, label).toBe('exact');
          if (card.step !== 'distance') {
            expect(solved(card, 3).verdict, label).not.toBe('exact');
          }
        }
      }
    }
  });

  it('миллинг: ответ — дальность в единицах игрока; в ярдах больше, чем в метрах, на ту же цель', () => {
    const metric = countCard('milling', 5, drillContext('metric'));
    const imperial = countCard('milling', 5, drillContext('imperial'));
    expect(metric.answer.sign).toBeNull();
    expect(imperial.answer.value).toBeGreaterThan(metric.answer.value);
  });

  it('ДОПЕ: дальность всегда между строками карточки', () => {
    for (const system of SYSTEMS) {
      for (let seed = 0; seed < 20; seed++) {
        const card = countCard('dope', seed, drillContext(system));
        const rowDistances = card.notebook.context.card.rows.map(row => row.distanceM);
        expect(rowDistances, `${system}/${seed}`).not.toContain(card.notebook.distanceM);
      }
    }
  });
});

describe('дрилы на позиции (T3.1)', () => {
  it('холодный выстрел: одна цель, один выстрел из холодного ствола', () => {
    const task = positionDrillTask('cold-bore', 'metric');
    expect([task.targets!.count, task.stages[0].maxShotsPerTarget, task.hasColdBore]).toEqual([1, 1, true]);
  });

  it('ветер-вилка: 3 цели на одной дистанции, ветер не ровный', () => {
    const task = positionDrillTask('wind-bracket', 'metric');
    const distances = setupTask(task, 4).targets.map(target => target.distanceM);
    expect(distances).toHaveLength(3);
    expect(new Set(distances).size).toBe(1);
    expect(task.conditions.isWindUniform).toBe(false);
  });

  it('лестница: 6 целей 200 → 700 по 100 — в метрах и в ярдах', () => {
    expect(setupTask(positionDrillTask('distance-ladder', 'metric'), 4, 'metric').targets.map(target => Math.round(target.distanceM))).toEqual([200, 300, 400, 500, 600, 700]);
    const yards = setupTask(positionDrillTask('distance-ladder', 'imperial'), 4, 'imperial').targets.map(target => Math.round(target.distanceM / 0.9144));
    expect(yards).toEqual([200, 300, 400, 500, 600, 700]);
  });

  it('дозор: движущиеся цели; этап: 5 целей по одному выстрелу', () => {
    expect(setupTask(positionDrillTask('patrol', 'metric'), 4).patrol).toBeDefined();
    const stage = positionDrillTask('timed-stage', 'metric');
    expect([stage.targets!.count, stage.stages[0].maxShotsPerTarget, stage.stages[0].closesOnHit]).toEqual([5, 1, true]);
  });

  it('своя винтовка уходит в задачу, без неё — винтовка курса', () => {
    expect(positionDrillTask('cold-bore', 'metric').rifle).toBeUndefined();
    expect(positionDrillTask('cold-bore', 'metric', builtInProfile()).rifle?.loadout).toEqual(loadoutOf(builtInProfile()));
  });
});
