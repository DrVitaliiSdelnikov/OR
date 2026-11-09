import { CARTRIDGES } from '../../core/content';
import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { CartridgeId, Correction } from '../../core/types';
import { FreePlayUnlocks } from '../../sim/course';
import { FreePlaySettings, WindPreset } from '../../sim/free-play';
import { ScopeId, SCOPES } from '../../sim/scope-model';
import { MODE_LABELS } from '../course/course-trail.model';

export interface ChoiceView<Id> {
  id: Id;
  label: string;
  line: string;
  lock: string | null;
  isChosen: boolean;
}

export interface FreePlayView {
  distanceText: string;
  unknownLock: string | null;
  winds: ChoiceView<WindPreset>[];
  modes: ChoiceView<NotebookMode>[];
  cartridges: ChoiceView<CartridgeId>[];
  scopes: ChoiceView<ScopeId>[];
  cartridgeTile: string;
  scopeTile: string;
}

const WIND_LABELS: Record<WindPreset, string> = { calm: 'штиль', light: 'слабый', moderate: 'умеренный', strong: 'сильный', gusty: 'порывистый' };
const SCOPE_OPENED_BY: Record<ScopeId, keyof FreePlayUnlocks | null> = {
  'course-tree': null,
  'course-dot': 'milDotScope',
  moa: 'moaScope',
  tree: 'longRangeScope',
  dot: 'secondFocalPlaneScope',
};
const OPENED_IN: Record<keyof FreePlayUnlocks, string> = {
  unknownDistance: '05',
  manualEasy: '06',
  milDotScope: '06',
  moaScope: '06',
  cartridgesAC: '08',
  gustyWind: '09',
  longRangeScope: '09',
  manualHard: '10',
  secondFocalPlaneScope: '12',
};
const MODE_OPENED_BY: Record<NotebookMode, keyof FreePlayUnlocks | null> = { auto: null, 'manual-easy': 'manualEasy', 'manual-hard': 'manualHard' };
const NOTHING_TO_SHOW_MIL = 0.05;

function lockOf(key: keyof FreePlayUnlocks | null, unlocks: FreePlayUnlocks): string | null {
  return key === null || unlocks[key] ? null : `откроется в упр. ${OPENED_IN[key]}`;
}

function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

export function freePlayView(settings: FreePlaySettings, unlocks: FreePlayUnlocks): FreePlayView {
  const chosenCartridge = CARTRIDGES.find(cartridge => cartridge.id === settings.cartridgeId)!;
  const chosenScope = SCOPES.find(scope => scope.id === settings.scopeId)!;
  return {
    distanceText: settings.isDistanceUnknown ? 'неизвестная' : `${settings.distanceM} м`,
    unknownLock: lockOf('unknownDistance', unlocks),
    winds: (Object.keys(WIND_LABELS) as WindPreset[]).map(id => ({
      id,
      label: WIND_LABELS[id],
      line: '',
      lock: lockOf(id === 'gusty' ? 'gustyWind' : null, unlocks),
      isChosen: settings.wind === id,
    })),
    modes: (Object.keys(MODE_LABELS) as NotebookMode[]).map(id => ({
      id,
      label: `${MODE_LABELS[id]} × ${modeMultiplier(id, false).toFixed(1)}`,
      line: '',
      lock: lockOf(MODE_OPENED_BY[id], unlocks),
      isChosen: settings.notebookMode === id,
    })),
    cartridges: CARTRIDGES.map(cartridge => ({
      id: cartridge.id,
      label: cartridge.name,
      line: `${decimal(cartridge.massG, 1)} г · ${cartridge.muzzleVelocityMps} м/с · BC ${decimal(cartridge.bcG7, 3)}`,
      lock: lockOf(cartridge.id === 'B' ? null : 'cartridgesAC', unlocks),
      isChosen: settings.cartridgeId === cartridge.id,
    })),
    scopes: SCOPES.map(scope => ({
      id: scope.id,
      label: scope.name,
      line: `${scope.magnificationMin}–${scope.magnificationMax}× · ${scope.units}`,
      lock: lockOf(SCOPE_OPENED_BY[scope.id], unlocks),
      isChosen: settings.scopeId === scope.id,
    })),
    cartridgeTile: chosenCartridge.name,
    scopeTile: chosenScope.name,
  };
}

export function instructorLineText(correction: Correction): string {
  const up = `${correction.upMrad >= 0 ? '↑' : '↓'} ${Math.abs(correction.upMrad).toFixed(1)}`;
  const side = Math.abs(correction.rightMrad) < NOTHING_TO_SHOW_MIL ? '' : ` ${correction.rightMrad > 0 ? '→' : '←'} ${Math.abs(correction.rightMrad).toFixed(1)}`;
  return `Расчётные данные: ${up}${side} MIL`;
}

