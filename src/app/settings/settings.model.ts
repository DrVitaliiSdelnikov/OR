import { text } from '../../i18n';

const DRUM_LABELS = text.screens.settings.drumSensitivities;

export interface Settings {
  volume: number;
  isHapticsOn: boolean;
  isDrumClicksOn: boolean;
  isLeftHanded: boolean;
  drumPtPerClick: number;
  isTapTrigger: boolean;
  isTextLarge: boolean;
  isTriggerZoneLarger: boolean;
  isMarkerDriftOff: boolean;
  isEverythingUnlocked: boolean;
}

export type SettingsFlag = { [Key in keyof Settings]: Settings[Key] extends boolean ? Key : never }[keyof Settings];

export const DRUM_SENSITIVITIES: readonly { ptPerClick: number; label: string }[] = [
  { ptPerClick: 16, label: DRUM_LABELS.precise },
  { ptPerClick: 12, label: DRUM_LABELS.normal },
  { ptPerClick: 8, label: DRUM_LABELS.fast },
];

export const DEFAULT_SETTINGS: Settings = {
  volume: 1,
  isHapticsOn: true,
  isDrumClicksOn: true,
  isLeftHanded: false,
  drumPtPerClick: 12,
  isTapTrigger: false,
  isTextLarge: false,
  isTriggerZoneLarger: false,
  isMarkerDriftOff: false,
  isEverythingUnlocked: false,
};

export const VOLUME_STEPS = 10;
const SETTINGS_FLAGS: readonly SettingsFlag[] = [
  'isHapticsOn',
  'isDrumClicksOn',
  'isLeftHanded',
  'isTapTrigger',
  'isTextLarge',
  'isTriggerZoneLarger',
  'isMarkerDriftOff',
  'isEverythingUnlocked',
];

export function knownSettings(stored: Record<string, unknown> | undefined): Settings {
  const known: Settings = { ...DEFAULT_SETTINGS };
  if (!stored) {
    return known;
  }
  for (const flag of SETTINGS_FLAGS) {
    if (typeof stored[flag] === 'boolean') {
      known[flag] = stored[flag];
    }
  }
  if (typeof stored['volume'] === 'number') {
    known.volume = steppedVolume(stored['volume']);
  } else if (stored['isSoundOn'] === false) {
    known.volume = 0;
  }
  if (DRUM_SENSITIVITIES.some(item => item.ptPerClick === stored['drumPtPerClick'])) {
    known.drumPtPerClick = stored['drumPtPerClick'] as number;
  }
  return known;
}

export function steppedVolume(volume: number): number {
  return Math.round(Math.min(1, Math.max(0, volume)) * VOLUME_STEPS) / VOLUME_STEPS;
}
