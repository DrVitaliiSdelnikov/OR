import { DEFAULT_FREE_PLAY, FreePlaySettings } from '../../sim/free-play';
import { FLAG_DISTANCES_M } from '../../core/content';
import { text } from '../../i18n';
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
const DOPE_SANDBOX = { distanceM: 450, lowerM: 400, upperM: 500 };
const S = text.textbook.sandboxes;

export const SANDBOXES: readonly Sandbox[] = [
  { terms: S.clicks.terms, settings: CALM_AT_300, hint: { anchor: 'drum-elevation', text: S.clicks.hint } },
  { terms: S.zeroStop.terms, settings: { distanceM: 100, wind: 'calm' }, hint: { anchor: 'drum-elevation', text: S.zeroStop.hint } },
  { terms: S.focalPlane.terms, settings: { distanceM: 500, wind: 'calm' }, hint: { anchor: 'zoom', text: S.focalPlane.hint } },
  { terms: S.milling.terms, settings: { isDistanceUnknown: true, wind: 'calm' }, hint: { anchor: 'glass', text: S.milling.hint } },
  { terms: S.wind.terms, settings: { distanceM: 400, wind: 'moderate' }, hint: { anchor: 'wind-tile', text: S.wind.hint } },
  { terms: S.flags.terms, settings: { distanceM: 600, wind: 'strong' }, hint: { anchor: 'glass', text: S.flags.hint({ flagDistancesM: FLAG_DISTANCES_M }) } },
  { terms: S.breathing.terms, settings: CALM_AT_300, hint: { anchor: 'hold', text: S.breathing.hint } },
  { terms: S.trigger.terms, settings: CALM_AT_300, hint: { anchor: 'fire-control', text: S.trigger.hint } },
  { terms: S.bolt.terms, settings: CALM_AT_300, hint: { anchor: 'fire-control', text: S.bolt.hint } },
  { terms: S.dope.terms, settings: { distanceM: DOPE_SANDBOX.distanceM, wind: 'calm' }, hint: { anchor: 'tile-dope', text: S.dope.hint(DOPE_SANDBOX) } },
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
