import { DEFAULT_FREE_PLAY, FreePlaySettings } from '../../sim/free-play';
import { rangeLayout } from '../../core/content';
import { fromInput, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { TeachingView } from '../instructor/teaching.model';

export interface SandboxHint {
  anchor: string;
  text: string | ((system: UnitSystem) => string);
}

export type SandboxSettings = Partial<Omit<FreePlaySettings, 'distanceM'>> & { distance?: number };

export interface Sandbox {
  terms: readonly string[];
  settings: SandboxSettings;
  hint: SandboxHint;
}

const CALM_AT_300: SandboxSettings = { distance: 300, wind: 'calm' };
const DOPE_SANDBOX = { distance: 450, lower: 400, upper: 500 };
const S = text.textbook.sandboxes;
const UNITS = text.units;

export const SANDBOXES: readonly Sandbox[] = [
  { terms: S.clicks.terms, settings: CALM_AT_300, hint: { anchor: 'drum-elevation', text: S.clicks.hint } },
  { terms: S.zeroStop.terms, settings: { distance: 100, wind: 'calm' }, hint: { anchor: 'drum-elevation', text: S.zeroStop.hint } },
  { terms: S.focalPlane.terms, settings: { distance: 500, wind: 'calm' }, hint: { anchor: 'zoom', text: S.focalPlane.hint } },
  { terms: S.milling.terms, settings: { isDistanceUnknown: true, wind: 'calm' }, hint: { anchor: 'glass', text: S.milling.hint } },
  { terms: S.wind.terms, settings: { distance: 400, wind: 'moderate' }, hint: { anchor: 'wind-tile', text: S.wind.hint } },
  { terms: S.flags.terms, settings: { distance: 600, wind: 'strong' }, hint: { anchor: 'glass', text: system => S.flags.hint({ flags: UNITS.listText('distance', rangeLayout(system).flagDistancesM, system, true) }) } },
  { terms: S.breathing.terms, settings: CALM_AT_300, hint: { anchor: 'hold', text: S.breathing.hint } },
  { terms: S.trigger.terms, settings: CALM_AT_300, hint: { anchor: 'fire-control', text: S.trigger.hint } },
  { terms: S.bolt.terms, settings: CALM_AT_300, hint: { anchor: 'fire-control', text: S.bolt.hint } },
  { terms: S.dope.terms, settings: { distance: DOPE_SANDBOX.distance, wind: 'calm' }, hint: { anchor: 'tile-dope', text: system => S.dope.hint({ ...DOPE_SANDBOX, distance: UNITS.displayText('distance', DOPE_SANDBOX.distance, system, 0) }) } },
];

const SANDBOX_TEACHING_ID = 'sandbox';

export function sandboxOf(term: string): Sandbox | null {
  return SANDBOXES.find(sandbox => sandbox.terms.includes(term)) ?? null;
}

export function sandboxSettings(sandbox: Sandbox, system: UnitSystem = 'metric'): FreePlaySettings {
  const { distance, ...settings } = sandbox.settings;
  return {
    ...DEFAULT_FREE_PLAY,
    ...settings,
    ...(distance === undefined ? {} : { distanceM: fromInput('distance', distance, system) }),
    notebookMode: 'auto',
    isInstructorNear: false,
  };
}

export function sandboxTeaching(sandbox: Sandbox, isAcknowledged: boolean, system: UnitSystem = 'metric'): TeachingView | null {
  if (isAcknowledged) {
    return null;
  }
  return { id: SANDBOX_TEACHING_ID, kind: 'explain', anchor: sandbox.hint.anchor, text: typeof sandbox.hint.text === 'string' ? sandbox.hint.text : sandbox.hint.text(system), number: null, count: null };
}
