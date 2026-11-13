import type { ExerciseId } from '../../sim/course';
import type { BoltStep } from '../../sim/bolt';
import type { TurretStop } from '../../sim/scope-model';
import type { BreathState } from '../../sim/sway';
import type { CorrectionCellKey } from '../../app/position/position.model';
import { decimal } from '../format';

export const position = {
  cells: {
    labels: { elevation: 'ВЕРТ', windage: 'ГОР', distance: 'ДИСТ', holdover: 'УДЕРЖ.' } satisfies Record<CorrectionCellKey, string>,
    distance: (p: { distanceM: number }) => `${p.distanceM} м`,
  },
  drum: {
    overshoot: (p: { clicks: number }) => `лишние ${p.clicks} кл.`,
    remaining: (p: { clicks: number; arrow: string }) => `ещё ${p.clicks} кл.${p.arrow}`,
    elevationLabel: 'Барабан высоты',
    windageLabel: 'Барабан ветра',
    clicksUnit: 'кл',
  },
  breath: {
    seconds: (p: { seconds: number }) => `${p.seconds.toFixed(1)} с`,
  },
  bolt: {
    steps: { up: '1 ↑', back: '2 ← НАЗАД', forward: '3 → ВПЕРЁД', down: '4 ↓' } satisfies Record<BoltStep, string>,
    header: (p: { stepNumber: number; stepCount: number }) => `Затвор · шаг ${p.stepNumber} из ${p.stepCount}`,
    trackLabel: 'Затвор: вверх, назад, вперёд, вниз',
    fireWaiting: 'Огонь · ждёт затвор',
  },
  flagReading: (p: { flagDistanceM: number; angleDeg: number; isAtLimit: boolean; crosswindText: string }) =>
    `${p.flagDistanceM} м · ${p.angleDeg}° · ${p.isAtLimit ? '≥ ' : ''}${p.crosswindText}`,
  patrolLine: (p: { speedMps: number; isCrosswise: boolean; headingArrow: string; isAmbush: boolean }) =>
    `${decimal(p.speedMps, 1)} м/с · ${p.isCrosswise ? 'поперёк' : 'наискось'} ${p.headingArrow}${p.isAmbush ? ' · засада' : ''}`,
  fireControl: {
    fire: 'Огонь',
  },
  page: {
    sandboxTitle: 'Попробовать на прицеле',
    holdLabels: { free: 'Держать', holding: 'Держу', cooldown: 'Выдох' } satisfies Record<BreathState, string>,
    exerciseTitle: (p: { exerciseId: ExerciseId; title: string }) => `Упр. ${p.exerciseId} · ${p.title}`,
    subtitle: (p: { distanceM: number | null; targetNumber: number; targetCount: number }) =>
      `рубеж · ${p.distanceM === null ? 'дистанция неизвестна' : `${p.distanceM} м`} · цель ${p.targetNumber} / ${p.targetCount}`,
    windSpeed: (p: { speedMps: number }) => `${p.speedMps.toFixed(1)} м/с`,
    calm: 'штиль',
    dopeEmpty: 'ДОПЕ · —',
    dope: (p: { distanceM: number; elevationMil: number }) => `ДОПЕ · ${p.distanceM} м ↑ ${p.elevationMil.toFixed(1)}`,
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
    stay: 'Остаться',
    leave: 'Покинуть',
  },
};
