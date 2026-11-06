import { createScenario, Scenario } from '../core/scenario';
import { CartridgeId } from '../core/types';
import { ScopeId } from './scope-model';

export interface QuizQuestion {
  question: string;
  answer: number;
  tolerance: number;
  unit: string;
  explanation: string;
}

interface TaskBase {
  id: string;
  title: string;
  level: number;
  blurb: string;
}

export interface QuizTask extends TaskBase {
  kind: 'quiz';
  questions: QuizQuestion[];
}

export interface ShootTask extends TaskBase {
  kind: 'shoot' | 'free';
  seed: number;
  targetIndex: number;
  cartridgeId: CartridgeId;
  scopeId: ScopeId;
  shots: number;
  windScale: number;
  restingBpm: number;
  hint?: string;
}

export type TaskDef = QuizTask | ShootTask;

export const UNIFORM_WIND_MAX_LEVEL = 2;
export const QUIZ_POINTS_PER_ANSWER = 10;

export const TASKS: readonly TaskDef[] = [
  {
    id: 'q-mrad',
    kind: 'quiz',
    title: 'Шкала: что такое mrad',
    level: 1,
    blurb: '1 mrad — это 1 м на 1000 м. Три коротких расчёта.',
    questions: [
      { question: 'Вы хотите сместить точку попадания на 0,4 м вправо на дистанции 400 м. Сколько mrad?', answer: 1, tolerance: 0.05, unit: 'mrad', explanation: '0,4 м ÷ 400 м × 1000 = 1,0 mrad.' },
      { question: 'Сколько кликов по 0,1 mrad нужно, чтобы дать 1,3 mrad?', answer: 13, tolerance: 0.5, unit: 'кл.', explanation: '1,3 ÷ 0,1 = 13 кликов.' },
      { question: 'Сколько метров в 2,5 mrad на дистанции 600 м?', answer: 1.5, tolerance: 0.05, unit: 'м', explanation: '2,5 × 600 ÷ 1000 = 1,5 м.' },
    ],
  },
  {
    id: 'q-range',
    kind: 'quiz',
    title: 'Дальность по сетке',
    level: 1,
    blurb: 'D = размер × 1000 ÷ mrad. Известный размер цели даёт дальность.',
    questions: [
      { question: 'Пластина 0,5 м занимает 1,0 mrad по сетке. Дальность?', answer: 500, tolerance: 25, unit: 'м', explanation: '0,5 × 1000 ÷ 1,0 = 500 м.' },
      { question: 'Пластина 0,35 м занимает 1,17 mrad. Дальность?', answer: 300, tolerance: 20, unit: 'м', explanation: '0,35 × 1000 ÷ 1,17 ≈ 299 м.' },
      { question: 'Пластина 0,7 м занимает 1,0 mrad. Дальность?', answer: 700, tolerance: 30, unit: 'м', explanation: '0,7 × 1000 ÷ 1,0 = 700 м.' },
    ],
  },
  {
    id: 's-zero',
    kind: 'shoot',
    title: 'Первый выстрел, штиль',
    level: 1,
    blurb: '300 м, ветра нет. Только поправка по высоте.',
    seed: 20261031,
    targetIndex: 0,
    cartridgeId: 'B',
    scopeId: 'dot',
    shots: 3,
    windScale: 0,
    restingBpm: 62,
    hint: 'Во вкладке «Расчёт» ветер 0, выставьте поправку по высоте на верхнем барабане.',
  },
  {
    id: 's-500',
    kind: 'shoot',
    title: '500 м, штиль',
    level: 1,
    blurb: 'Больше дистанция, больше падение пули.',
    seed: 20261032,
    targetIndex: 1,
    cartridgeId: 'B',
    scopeId: 'tree',
    shots: 3,
    windScale: 0,
    restingBpm: 62,
  },
  {
    id: 'q-clock',
    kind: 'quiz',
    title: 'Ветер по часам',
    level: 2,
    blurb: 'Ветер с 3 или 9 часов даёт полный снос, с 12 или 6 — нулевой, с диагоналей — примерно половину.',
    questions: [
      { question: 'Ветер 6 м/с с 9 часов. Сколько м/с даёт боковой снос?', answer: 6, tolerance: 0.4, unit: 'м/с', explanation: '9 и 3 часа — полное значение, 6 м/с.' },
      { question: 'Ветер 6 м/с с 10:30. Сколько м/с даёт боковой снос (правило половины)?', answer: 3, tolerance: 0.7, unit: 'м/с', explanation: 'Диагонали дают примерно половину: 3 м/с.' },
      { question: 'Ветер 8 м/с с 12 часов. Сколько м/с даёт боковой снос?', answer: 0, tolerance: 0.3, unit: 'м/с', explanation: 'Встречный ветер бокового сноса почти не даёт.' },
    ],
  },
  {
    id: 's-wind300',
    kind: 'shoot',
    title: 'Боковой ветер, 300 м',
    level: 2,
    blurb: 'Прибор покажет ветер. Он не стоит на месте.',
    seed: 20261033,
    targetIndex: 0,
    cartridgeId: 'B',
    scopeId: 'tree',
    shots: 4,
    windScale: 0.7,
    restingBpm: 65,
  },
  {
    id: 'q-moa',
    kind: 'quiz',
    title: 'MIL и MOA',
    level: 2,
    blurb: '1 mrad ≈ 3,44 MOA. Барабан в MOA потребует пересчёта.',
    questions: [
      { question: 'Сколько MOA в 2 mrad?', answer: 6.9, tolerance: 0.3, unit: 'MOA', explanation: '2 × 3,44 = 6,88 MOA.' },
      { question: 'Сколько кликов по ¼ MOA в 3 MOA?', answer: 12, tolerance: 0.5, unit: 'кл.', explanation: '3 ÷ 0,25 = 12 кликов.' },
    ],
  },
  {
    id: 's-moa500',
    kind: 'shoot',
    title: 'Прицел в MOA, 500 м',
    level: 3,
    blurb: 'Нужная поправка в mrad, барабан в MOA. Температура и давление теперь важны, ветер на трассе разный.',
    seed: 20261034,
    targetIndex: 1,
    cartridgeId: 'C',
    scopeId: 'moa',
    shots: 4,
    windScale: 0.8,
    restingBpm: 65,
  },
  {
    id: 's-700',
    kind: 'shoot',
    title: '700 м, финал модуля',
    level: 3,
    blurb: 'Дальняя мишень, порывы, флаги на трассе и пульс.',
    seed: 20261035,
    targetIndex: 2,
    cartridgeId: 'A',
    scopeId: 'tree',
    shots: 5,
    windScale: 1,
    restingBpm: 72,
  },
];

export const FREE_TASK: ShootTask = {
  id: 'free',
  kind: 'free',
  title: 'Свободная стрельба',
  level: 3,
  blurb: 'Случайный ветер, любой прицел, патрон и дистанция.',
  seed: 0,
  targetIndex: 1,
  cartridgeId: 'B',
  scopeId: 'tree',
  shots: 99,
  windScale: 1,
  restingBpm: 65,
};

export function taskById(id: string): TaskDef | undefined {
  return id === FREE_TASK.id ? FREE_TASK : TASKS.find(task => task.id === id);
}

export function maxScore(task: TaskDef): number {
  return task.kind === 'quiz' ? task.questions.length * QUIZ_POINTS_PER_ANSWER : task.shots * 10;
}

export function hasZoneWind(task: ShootTask): boolean {
  return task.level > UNIFORM_WIND_MAX_LEVEL && task.windScale > 0;
}

export function scenarioForTask(task: ShootTask, seed = task.seed): Scenario {
  return createScenario(seed, { windScale: task.windScale, isWindUniform: !hasZoneWind(task) });
}

export function isAnswerCorrect(question: QuizQuestion, value: number): boolean {
  return Math.abs(value - question.answer) <= question.tolerance;
}

export function isTaskUnlocked(task: TaskDef, passedIds: ReadonlySet<string>, isEverythingUnlocked: boolean): boolean {
  if (isEverythingUnlocked) {
    return true;
  }
  const index = TASKS.findIndex(candidate => candidate.id === task.id);
  return index <= 0 || passedIds.has(TASKS[index - 1].id);
}
