import type { DrillId } from '../../sim/drills';

export const drills = {
  titles: {
    milling: 'Миллинг',
    dope: 'ДОПЕ с интерполяцией',
    wind: 'Ветер',
    conditions: 'Условия',
    angle: 'Угол места',
    lead: 'Упреждение',
    'cold-bore': 'Холодный выстрел',
    'wind-bracket': 'Ветер-вилка',
    'distance-ladder': 'Лестница дистанций',
    patrol: 'Дозор',
    'timed-stage': 'Этап на время',
  } satisfies Record<DrillId, string>,
};
