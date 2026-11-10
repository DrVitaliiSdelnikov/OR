import { DEFAULT_FREE_PLAY, FreePlaySettings } from '../../sim/free-play';
import { TeachingView } from '../instructor/teaching.model';

export interface SandboxHint {
  anchor: string;
  text: string;
}

export interface Sandbox {
  terms: readonly string[];
  settings: Partial<FreePlaySettings>;
  hint: SandboxHint;
}

const CALM_AT_300: Partial<FreePlaySettings> = { distanceM: 300, wind: 'calm' };

export const SANDBOXES: readonly Sandbox[] = [
  {
    terms: ['клик', 'барабан'],
    settings: CALM_AT_300,
    hint: { anchor: 'drum-elevation', text: 'Один щелчок — 0,1 MIL. Покрути барабан ВЕРТ и смотри, как сдвигается сетка' },
  },
  {
    terms: ['ZERO STOP'],
    settings: { distanceM: 100, wind: 'calm' },
    hint: { anchor: 'drum-elevation', text: 'Ты на ноле. Покрути барабан ВЕРТ вниз — ниже ноля он не пойдёт: упор ZERO STOP' },
  },
  {
    terms: ['кратность', 'фокальная плоскость'],
    settings: { distanceM: 500, wind: 'calm' },
    hint: { anchor: 'zoom', text: 'Крути кратность — метки сетки растут вместе с гонгом: первая фокальная плоскость, MIL верен на любой кратности' },
  },
  {
    terms: ['сетка', 'миллинг'],
    settings: { isDistanceUnknown: true, wind: 'calm' },
    hint: { anchor: 'glass', text: 'Дистанция неизвестна. Измерь гонг сеткой в MIL, потом блокнот → ДИСТАНЦИЯ: внеси замер' },
  },
  {
    terms: ['метеостанция', 'ветер', 'правило часов', 'доля по часам'],
    settings: { distanceM: 400, wind: 'moderate' },
    hint: { anchor: 'wind-tile', text: 'Ветер с метеостанции: скорость и час. Тапни — на часах ветра видна доля бокового ветра' },
  },
  {
    terms: ['флажок'],
    settings: { distanceM: 600, wind: 'strong' },
    hint: { anchor: 'glass', text: 'Флажки на 200, 400 и 600 м. Чем сильнее ветер поперёк, тем круче полотнище' },
  },
  {
    terms: ['дыхание', 'пульс'],
    settings: CALM_AT_300,
    hint: { anchor: 'hold', text: 'Держи — дыхание задержано, сетка успокаивается. Держишь долго — снова качает' },
  },
  {
    terms: ['спуск'],
    settings: CALM_AT_300,
    hint: { anchor: 'fire-control', text: 'Дави на спуск плавно, пока не выстрелит. Резкий рывок уводит пулю' },
  },
  {
    terms: ['затвор'],
    settings: CALM_AT_300,
    hint: { anchor: 'fire-control', text: 'Выстрели — потом перезаряди затвором: вверх, назад, вперёд, вниз' },
  },
  {
    terms: ['ДОПЕ', 'строка ДОПЕ'],
    settings: { distanceM: 450, wind: 'calm' },
    hint: { anchor: 'tile-dope', text: 'Карточка ДОПЕ: для 450 м строки нет — поправка берётся между 400 и 500' },
  },
];

const SANDBOX_TEACHING_ID = 'sandbox';

export function sandboxOf(term: string): Sandbox | null {
  return SANDBOXES.find(sandbox => sandbox.terms.includes(term)) ?? null;
}

export function sandboxSettings(sandbox: Sandbox): FreePlaySettings {
  return { ...DEFAULT_FREE_PLAY, ...sandbox.settings, notebookMode: 'auto', isInstructorNear: false };
}

export function sandboxTeaching(sandbox: Sandbox, isAcknowledged: boolean): TeachingView | null {
  if (isAcknowledged) {
    return null;
  }
  return { id: SANDBOX_TEACHING_ID, kind: 'explain', anchor: sandbox.hint.anchor, text: sandbox.hint.text, number: null, count: null };
}
