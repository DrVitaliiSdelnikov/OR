import type { MainCause } from '../../sim/miss-breakdown';
import { percent } from '../format';

export const result = {
  classStamp: (p: { exerciseClass: number }) => `${p.exerciseClass} КЛАСС`,
  notAdmittedStamp: 'НЕ ЗАЧТЕНО',
  allFirstPaper: 'все в мишень',
  allFirst: 'все первым',
  rankPlate: (p: { rank: string }) => `Звание: ${p.rank}`,
  opened: (p: { exerciseId: string; title: string }) => `Открыто: ${p.exerciseId} · ${p.title}`,
  classLabel: (p: { exerciseClass: number }) => `${p.exerciseClass} класс`,
  thirdClassRow: (p: { minShare: number; share: number }) => `≥ ${percent(p.minShare)} очков — ${percent(p.share)}`,
  secondClassRow: (p: { minShare: number; goal: string; fact: string }) => `≥ ${percent(p.minShare)} и ${p.goal} — ${p.fact}`,
  firstClassRow: (p: { goal: string; fact: string }) => `${p.goal} — ${p.fact}`,
  bothGoals: (p: { allFirst: string; goal: string }) => `${p.allFirst} и ${p.goal}`,
  factMil: (p: { valueMil: number }) => `${p.valueMil.toFixed(1)} MIL`,
  factTally: (p: { passed: number; total: number }) => `${p.passed} из ${p.total}`,
  factYes: 'да',
  factNo: 'нет',
  sharePercent: (p: { share: number }) => percent(p.share),
  paperHits: (p: { hits: number; shots: number }) => `попаданий ${p.hits} из ${p.shots} · `,
  multiplied: (p: { multiplier: number; total: number }) => ` × ${p.multiplier} = ${p.total}`,
  referencePenalty: (p: { penalty: number; total: number }) => ` − ${p.penalty} справочник = ${p.total}`,
  score: (p: { prefix: string; targetSum: number; calcSum: number; sum: number; suffix: string }) =>
    `${p.prefix}цели ${p.targetSum} + расчёт ${p.calcSum} = ${p.sum}${p.suffix}`,
  newRecord: 'новый рекорд',
  record: (p: { total: number }) => `рекорд ${p.total}`,
  noErrors: 'Ошибок нет',
  mainCauseLine: (p: { count: number; total: number; cause: string }) => `${p.count} из ${p.total} — ${p.cause}`,
  unmetGoal: (p: { goal: string }) => `Не выполнено: ${p.goal}`,
  minShareGoal: (p: { minShare: number }) => `≥ ${percent(p.minShare)} очков`,
  mainCauses: {
    calc: 'ошибка расчёта',
    'wind-under': 'недооценка ветра',
    'wind-over': 'переоценка ветра',
    hold: 'удержание сетки',
    lead: 'упреждение',
    trigger: 'срыв спуска',
    zero: 'ноль прицела',
  } satisfies Record<MainCause, string>,
};

export const briefing = {
  header: (p: { exerciseId: string; kind: 'intro' | 'attestation' | 'training' }) =>
    `ЗАДАНИЕ ${p.exerciseId} · ${{ intro: 'ВВОДНОЕ', attestation: 'АТТЕСТАЦИЯ', training: 'УЧЕБНОЕ' }[p.kind]}`,
  introLine: 'Без стрельбы и оценки. Семь шагов: винтовка, прицел, барабан, кратность, сетки, патроны, затвор',
  thirdClass: (p: { minShare: number }) => `3 класс — от ${percent(p.minShare)} очков`,
  secondClass: (p: { minShare: number; goal: string }) => `2 класс — ${percent(p.minShare)} и ${p.goal}`,
  firstClass: (p: { goal: string }) => `1 класс — ${p.goal}`,
  novelty: (p: { novelty: string }) => `Новое: ${p.novelty}`,
  best: (p: { stamp: string; total: number }) => `лучший: ${p.stamp} · ${p.total} очк.`,
  bestNotAdmitted: 'не зачтено',
  terms: (p: { terms: readonly string[] }) => `узнаешь: ${p.terms.join(' · ')}`,
  fixedDistance: (p: { distanceM: number }) => `${p.distanceM} м`,
  knownDistance: (p: { fromM: number; toM: number }) => `${p.fromM}–${p.toM} м`,
  unknownDistance: (p: { fromM: number; toM: number }) => `${p.fromM}–${p.toM} м · неизвестно`,
  mode: (p: { label: string; multiplier: number }) => `${p.label} × ${p.multiplier.toFixed(1)}`,
  noMode: '—',
};
