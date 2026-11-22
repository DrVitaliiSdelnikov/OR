import type { ExerciseId } from '../../sim/course';
import type { BoltStep } from '../../sim/bolt';
import type { TurretStop } from '../../sim/scope-model';
import type { BreathState } from '../../sim/sway';
import type { CorrectionCellKey } from '../../app/position/position.model';
import { decimal } from '../format';

export const position = {
  cells: {
    labels: { elevation: 'ВЕРТ', windage: 'ГОР', distance: 'ДИСТ', holdover: 'УДЕРЖ.' } satisfies Record<CorrectionCellKey, string>,
    distance: (p: { distance: string }) => p.distance,
  },
  drum: {
    overshoot: (p: { clicks: number }) => `лишние ${p.clicks} кл.`,
    remaining: (p: { clicks: number; arrow: string }) => `ещё ${p.clicks} кл.${p.arrow}`,
    elevationLabel: 'Барабан высоты',
    windageLabel: 'Барабан ветра',
    clicksUnit: 'кл',
  },
  breath: {
    seconds: (p: { seconds: number }) => `${decimal(p.seconds, 1)} с`,
  },
  bolt: {
    steps: { up: '1 ↑', back: '2 ← НАЗАД', forward: '3 → ВПЕРЁД', down: '4 ↓' } satisfies Record<BoltStep, string>,
    header: (p: { stepNumber: number; stepCount: number }) => `Затвор · шаг ${p.stepNumber} из ${p.stepCount}`,
    trackLabel: 'Затвор: вверх, назад, вперёд, вниз',
    fireWaiting: 'Огонь · ждёт затвор',
  },
  flagReading: (p: { flagDistance: string; angleDeg: number; isAtLimit: boolean; crosswindText: string }) =>
    `${p.flagDistance} · ${p.angleDeg}° · ${p.isAtLimit ? '≥ ' : ''}${p.crosswindText}`,
  patrolLine: (p: { speed: string; isCrosswise: boolean; headingArrow: string; isAmbush: boolean }) =>
    `${p.speed} · ${p.isCrosswise ? 'поперёк' : 'наискось'} ${p.headingArrow}${p.isAmbush ? ' · засада' : ''}`,
  fireControl: {
    fire: 'Огонь',
  },
  page: {
    sandboxTitle: 'Попробовать на прицеле',
    holdLabels: { free: 'Держать', holding: 'Держу', cooldown: 'Выдох' } satisfies Record<BreathState, string>,
    exerciseTitle: (p: { exerciseId: ExerciseId; title: string }) => `Упр. ${p.exerciseId} · ${p.title}`,
    subtitle: (p: { distance: string | null; targetNumber: number; targetCount: number }) =>
      `рубеж · ${p.distance === null ? 'дистанция неизвестна' : p.distance} · цель ${p.targetNumber} / ${p.targetCount}`,
    windSpeed: (p: { speed: string }) => p.speed,
    calm: 'штиль',
    dopeEmpty: 'ДОПЕ · —',
    dope: (p: { distance: string; elevationMil: number }) => `ДОПЕ · ${p.distance} ↑ ${decimal(p.elevationMil, 1)}`,
    stopBadges: { zero: 'ZERO STOP', top: 'УПОР ВВЕРХ', side: 'УПОР' } satisfies Record<NonNullable<TurretStop>, string>,
    back: 'Назад',
    notFilled: 'не заполнено',
    unavailable: 'Упражнение пока недоступно',
    triggerZone: 'ЗОНА СПУСКА',
    zoomOut: 'Уменьшить кратность',
    zoomIn: 'Увеличить кратность',
    notebook: 'Блокнот',
    notEntered: 'итог не внесён',
    changeMagazine: 'Сменить магазин',
    leaveQuestion: 'Покинуть позицию? Упражнение не засчитается',
    leaveDailyQuestion: 'Покинуть позицию? Задание дня не засчитается',
    stay: 'Остаться',
    leave: 'Покинуть',
  },
};
