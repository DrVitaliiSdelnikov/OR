import { describe, expect, it } from 'vitest';
import { courseLoadout, rangeLayout } from '../core/content';
import { createScenario } from '../core/scenario';
import { inSystem } from '../core/units';
import { COURSE, ExerciseDef, exerciseById, ExerciseId, exerciseTitle, setupTask } from './course';
import { DEFAULT_FREE_PLAY, FREE_PLAY_DISTANCES_M, freePlayDistances, freePlayDistanceIn, freePlayTask } from './free-play';

const SEEDS = Array.from({ length: 60 }, (_, index) => index * 7919 + 3);
const yardsOf = (distanceM: number): number => Number(inSystem('distance', distanceM, 'imperial').toFixed(6));
const inchesOf = (diameterM: number): number => Number(inSystem('targetSize', diameterM, 'imperial').toFixed(6));

function exercise(id: ExerciseId): ExerciseDef {
  return exerciseById(id)!;
}

function imperialYards(id: ExerciseId): number[] {
  return [...new Set(SEEDS.flatMap(seed => setupTask(exercise(id), seed, 'imperial').targets.map(target => yardsOf(target.distanceM))))].sort((a, b) => a - b);
}

describe('дистанции курса в имперских (T1.8c)', () => {
  it('фиксированные — ближайшие 25 ярдов: 300 м → 325, 100 м → 100, 400 м → 425, 600 м → 650', () => {
    expect(imperialYards('01')).toEqual([325]);
    expect(imperialYards('02')).toEqual([100]);
    expect(imperialYards('10')).toEqual([425]);
    expect(imperialYards('08')).toEqual([650]);
  });

  it('известные — шагом 50 ярдов, границы — ближайшие 50', () => {
    expect(imperialYards('06')).toEqual([450, 500, 550]);
    expect(imperialYards('07')).toEqual([550, 600, 650]);
    expect(imperialYards('09')).toEqual([550, 600, 650, 700, 750]);
    expect(imperialYards('11')).toEqual([350, 400, 450, 500, 550]);
    expect(imperialYards('13')).toEqual([450, 500, 550, 600, 650, 700, 750]);
  });

  it('14 — не дальше 1000 ярдов, последней строки карточки', () => {
    expect(imperialYards('14')).toEqual([850, 900, 950, 1000]);
  });

  it('неизвестные — целые 5 ярдов внутри границ, никогда не кратные 50', () => {
    for (const [id, fromYards, toYards] of [['05', 350, 650], ['12', 200, 750]] as const) {
      const yards = imperialYards(id);
      expect(yards.every(value => value >= fromYards && value <= toYards && value % 5 === 0 && value % 50 !== 0), id).toBe(true);
      expect(yards.length, id).toBeGreaterThan(5);
    }
  });

  it('тот же сид — тот же номер шага: 06 на 400 м ↔ 450 ярдов, 500 м ↔ 550 ярдов', () => {
    for (const seed of SEEDS) {
      const metric = setupTask(exercise('06'), seed).targets.map(target => target.distanceM);
      const imperial = setupTask(exercise('06'), seed, 'imperial').targets.map(target => yardsOf(target.distanceM));
      expect(imperial).toEqual(metric.map(distanceM => ({ 400: 450, 450: 500, 500: 550 })[distanceM]));
    }
  });

  it('метрика — прежняя: дистанции всех упражнений те же, что без системы', () => {
    for (const def of COURSE) {
      for (const seed of SEEDS.slice(0, 10)) {
        expect(setupTask(def, seed, 'metric').targets, def.id).toEqual(setupTask(def, seed).targets);
      }
    }
    expect(setupTask(exercise('06'), 3).targets.map(target => target.distanceM).every(distanceM => [400, 450, 500].includes(distanceM))).toBe(true);
  });
});

describe('гонги и ноль в имперских (T1.8c)', () => {
  it('гонг 20″ до 650 ярдов, 28″ дальше; бумажная мишень 03 — 14″; пристрелочная 02 — 20″', () => {
    const diameters = (id: ExerciseId) => [...new Set(SEEDS.flatMap(seed => setupTask(exercise(id), seed, 'imperial').targets.map(target => inchesOf(target.diameterM))))];
    expect(diameters('06')).toEqual([20]);
    expect(diameters('08')).toEqual([20]);
    expect(diameters('14')).toEqual([28]);
    expect(diameters('03')).toEqual([14]);
    expect(diameters('02')).toEqual([20]);
    const target675 = setupTask(exercise('09'), SEEDS.find(seed => setupTask(exercise('09'), seed, 'imperial').targets.some(target => yardsOf(target.distanceM) === 700))!, 'imperial').targets.find(
      target => yardsOf(target.distanceM) === 700,
    )!;
    expect(inchesOf(target675.diameterM)).toBe(28);
  });

  it('большой гонг — дальше 650 ярдов: на 655 ярдах в 12 уже 28″', () => {
    const seed = SEEDS.concat(Array.from({ length: 400 }, (_, index) => index + 1)).find(candidate => setupTask(exercise('12'), candidate, 'imperial').targets.some(target => yardsOf(target.distanceM) === 655))!;
    const target = setupTask(exercise('12'), seed, 'imperial').targets.find(item => yardsOf(item.distanceM) === 655)!;
    expect(inchesOf(target.diameterM)).toBe(28);
  });

  it('метрические гонги прежние: 0,5 м и 0,7 м дальше 600 м', () => {
    expect(setupTask(exercise('08'), 5, 'metric').targets[0].diameterM).toBe(0.5);
    expect(setupTask(exercise('14'), 5, 'metric').targets[0].diameterM).toBe(0.7);
  });

  it('ноль учебной винтовки — 100 ярдов в имперских, 100 м в метрике', () => {
    expect(yardsOf(courseLoadout('B', 'imperial').rifle.zeroM)).toBe(100);
    expect(courseLoadout('B', 'metric').rifle.zeroM).toBe(100);
    expect(courseLoadout('B').rifle.zeroM).toBe(100);
  });
});

describe('флажки и зоны в имперских (T1.8c)', () => {
  it('флажки на 200 / 400 / 600 ярдов, границы зон 150 / 350 / 550 ярдов', () => {
    expect(rangeLayout('imperial').flagDistancesM.map(yardsOf)).toEqual([200, 400, 600]);
    expect(rangeLayout('imperial').windZoneLimitsM.slice(0, 3).map(yardsOf)).toEqual([150, 350, 550]);
    expect(rangeLayout('metric').flagDistancesM).toEqual([200, 400, 600]);
    expect(rangeLayout('metric').windZoneLimitsM).toEqual([150, 350, 550, Infinity]);
  });

  it('сценарий строит зоны и флажки по раскладке, ветер по сиду тот же', () => {
    const metric = createScenario(42, {});
    const imperial = createScenario(42, {}, rangeLayout('imperial'));
    expect(imperial.zones.map(zone => zone.untilM)).toEqual(rangeLayout('imperial').windZoneLimitsM);
    expect(imperial.flags.map(flag => yardsOf(flag.distanceM))).toEqual([200, 400, 600]);
    expect(imperial.zones.map(zone => [zone.speedMps, zone.fromDeg])).toEqual(metric.zones.map(zone => [zone.speedMps, zone.fromDeg]));
    expect(createScenario(42, {}, rangeLayout('metric'))).toEqual(metric);
  });
});

describe('название 10 в единицах игрока (T1.8c)', () => {
  it('«Пристрелка на 425» в имперских, «на 400» в метрике; прочие — как есть', () => {
    expect(exerciseTitle(exercise('10'), 'imperial')).toBe('Пристрелка на 425');
    expect(exerciseTitle(exercise('10'), 'metric')).toBe(exercise('10').title);
    expect(exerciseTitle(exercise('06'), 'imperial')).toBe(exercise('06').title);
  });
});

describe('свободная игра в имперских (T1.8c)', () => {
  it('ползунок 100…1000 ярдов шагом 50; метрический — прежний', () => {
    expect(freePlayDistances('imperial').map(yardsOf)).toEqual(Array.from({ length: 19 }, (_, index) => 100 + index * 50));
    expect(freePlayDistances('metric')).toEqual(FREE_PLAY_DISTANCES_M);
  });

  it('смена системы — то же число на ползунке: 300 м ↔ 300 ярдов; чужое значение — ближайшее', () => {
    expect(yardsOf(freePlayDistanceIn('imperial', 300))).toBe(300);
    expect(yardsOf(freePlayDistanceIn('imperial', 1000))).toBe(1000);
    expect(freePlayDistanceIn('metric', freePlayDistances('imperial')[5])).toBe(350);
    expect(freePlayDistanceIn('metric', 450)).toBe(450);
    expect(yardsOf(freePlayDistanceIn('imperial', freePlayDistances('imperial')[3]))).toBe(250);
    expect(yardsOf(freePlayDistanceIn('imperial', 333))).toBe(350);
  });

  it('горы — не дальше 750 ярдов, дальний рубеж — от 650; неизвестная — в границах местности', () => {
    const mountains = freePlayTask({ ...DEFAULT_FREE_PLAY, terrain: 'mountains', distanceM: freePlayDistances('imperial').at(-1)! }, null, 'imperial');
    expect(yardsOf(setupTask(mountains, 1, 'imperial').targets[0].distanceM)).toBe(750);
    const longRange = freePlayTask({ ...DEFAULT_FREE_PLAY, terrain: 'long-range', distanceM: freePlayDistances('imperial')[0] }, null, 'imperial');
    expect(yardsOf(setupTask(longRange, 1, 'imperial').targets[0].distanceM)).toBe(650);
    const unknown = freePlayTask({ ...DEFAULT_FREE_PLAY, terrain: 'mountains', isDistanceUnknown: true }, null, 'imperial');
    for (const seed of SEEDS) {
      const yards = yardsOf(setupTask(unknown, seed, 'imperial').targets[0].distanceM);
      expect(yards >= 100 && yards <= 750 && yards % 5 === 0 && yards % 50 !== 0, String(yards)).toBe(true);
    }
  });
});
