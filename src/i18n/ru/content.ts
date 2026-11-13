import type { CartridgeId } from '../../core/types';
import type { ExerciseGoalTexts, ExerciseId } from '../../sim/course';
import type { ScopeId } from '../../sim/scope-model';
import { decimal, percent } from '../format';

interface MagnificationRange {
  magnificationMin: number;
  magnificationMax: number;
}

const zoomText = (scope: MagnificationRange): string => `${scope.magnificationMin}–${scope.magnificationMax}×`;

export const content = {
  rifleName: '«Рубеж-1», класс .308',
  cartridges: {
    A: { name: 'Патрон А', blurb: 'лёгкая быстрая пуля' },
    B: { name: 'Патрон Б', blurb: 'средняя пуля' },
    C: { name: 'Патрон В', blurb: 'тяжёлая пуля, высокий BC' },
  } satisfies Record<CartridgeId, { name: string; blurb: string }>,
  scopes: {
    'course-tree': (scope: MagnificationRange) => `Курсовой ${zoomText(scope)} · Ёлка`,
    'course-dot': (scope: MagnificationRange) => `Курсовой ${zoomText(scope)} · MIL-dot`,
    moa: (scope: MagnificationRange) => `MOA ${zoomText(scope)}`,
    tree: (scope: MagnificationRange) => `Дальний ${zoomText(scope)} · Ёлка`,
    dot: (scope: MagnificationRange) => `Старый ${zoomText(scope)} · MIL-dot · 2-я плоскость`,
  } satisfies Record<ScopeId, (scope: MagnificationRange) => string>,
  freePlayTitle: 'Свободная игра',
  exerciseTitles: {
    '00': 'Винтовка и прицел',
    '01': 'Первые щелчки',
    '02': 'Ноль и холодный ствол',
    '03': 'Дыхание и спуск',
    '04': 'Флажок на бруствере',
    '05': 'Дистанции: ДОПЕ и дальномер',
    '06': 'Часы ветра',
    '07': 'Холодное утро',
    '08': 'Три патрона',
    '09': 'Флажки по трассе',
    '10': (p: { distanceM: number }) => `Пристрелка на ${p.distanceM}`,
    '11': 'Движущийся дозор',
    '12': 'Полевой рубеж',
  },
  goals: {
    '00': { second: '', first: null },
    '01': { second: 'накрутка ровно по итогу с первого раза', first: null },
    '02': (p: { groupFirstShot: number; groupLastShot: number; groupMaxMil: number; controlMaxMil: number }): ExerciseGoalTexts => ({
      second: `группа ${p.groupFirstShot}–${p.groupLastShot} ≤ ${decimal(p.groupMaxMil)} MIL`,
      first: `холодный — без срыва спуска, контрольный ≤ ${decimal(p.controlMaxMil)} MIL от точки прицеливания`,
    }),
    '03': (p: { targets: number }): ExerciseGoalTexts => ({ second: 'ни одного сорванного спуска', first: `все ${p.targets} с задержкой дыхания в окне` }),
    '04': { second: 'скорость перенесена без ошибки', first: 'вклад ветра учтён на всех' },
    '05': (p: { secondClassTolerance: number; firstClassTolerance: number }): ExerciseGoalTexts => ({
      second: `дальность ±${percent(p.secondClassTolerance)} на всех`,
      first: `дальность ±${percent(p.firstClassTolerance)} на всех`,
    }),
    '06': { second: 'проверка расчёта без «ошибки» на всех', first: '«точно» на всех' },
    '07': { second: 'условия учтены на всех', first: '«точно» на всех' },
    '08': { second: 'верный расчёт для всех трёх патронов', first: '«точно» для всех трёх' },
    '09': { second: 'ни одной ошибки СТОРОНА', first: '«точно» на всех' },
    '10': (p: { callToleranceMil: number }): ExerciseGoalTexts => ({
      second: 'все промахи первым выстрелом добиты вторым',
      first: `вызов точен (≤ ${decimal(p.callToleranceMil)} MIL) на всех`,
    }),
    '11': (p: { minTargetsHit: number; targets: number }): ExerciseGoalTexts => ({
      second: `≥ ${p.minTargetsHit} из ${p.targets} и ни одной ошибки СТОРОНА`,
      first: `${p.targets} из ${p.targets}, засадой — все первым выстрелом`,
    }),
    '12': { second: 'без справочника', first: 'САМ сложный' },
  },
  novelties: {
    '00': 'знакомство: части винтовки и прицела, барабан двигает точку попадания, кратность, сетки',
    '01': 'барабаны, клики, ДОПЕ подсказкой; спуск — тап; затвор — сам',
    '02': 'вызов выстрела (ставит игра), группа',
    '03': 'полный спуск с давлением, дыхание, затвор Г-дорожкой',
    '04': 'ветер, метеостанция, флажок у бруствера',
    '05': 'неизвестная дистанция, миллинг по сетке',
    '06': 'режим САМ лёгкий',
    '07': null,
    '08': 'смена патрона внутри упражнения',
    '09': 'разный ветер по трассе, мираж',
    '10': 'САМ сложный, вызов выстрела игроком, карандаш в ДОПЕ',
    '11': 'движущиеся цели, упреждение сеткой, шаг «Упреждение» в блокноте',
    '12': null,
  } satisfies Record<ExerciseId, string | null>,
};
