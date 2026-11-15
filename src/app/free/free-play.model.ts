import { CARTRIDGES } from '../../core/content';
import { decimal } from '../../i18n/format';
import { text } from '../../i18n';
import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { CartridgeId, Correction } from '../../core/types';
import { FreePlayUnlocks } from '../../sim/course';
import { FreePlayRifle, FreePlaySettings, Terrain, TERRAIN_PRESETS, WindPreset } from '../../sim/free-play';
import { UnitSystem } from '../../core/units';
import { RifleProfile } from '../../sim/rifle-profile';
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
  distanceSliderLabel: string;
  unknownLock: string | null;
  winds: ChoiceView<WindPreset>[];
  terrains: ChoiceView<Terrain>[];
  modes: ChoiceView<NotebookMode>[];
  cartridges: ChoiceView<CartridgeId>[];
  scopes: ChoiceView<ScopeId>[];
  cartridgeTile: string;
  scopeTile: string;
  rifles: ChoiceView<FreePlayRifle>[];
  isOwnRifle: boolean;
}

const T = text.screens.freePlay;
const RIFLE_TEXTS = text.rifle.freePlay;
const WIND_LABELS: Record<WindPreset, string> = T.winds;
const TERRAIN_LABELS: Record<Terrain, string> = T.terrains;
const UNITS = text.units;
const ANGLE_RANGE_SEPARATOR = '–';
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
  return key === null || unlocks[key] ? null : T.opensIn({ exerciseId: OPENED_IN[key] });
}


export function freePlayView(settings: FreePlaySettings, unlocks: FreePlayUnlocks, activeProfile: RifleProfile | null = null, system: UnitSystem = 'metric'): FreePlayView {
  const isOwnRifle = settings.rifle === 'own' && activeProfile !== null;
  const chosenCartridge = CARTRIDGES.find(cartridge => cartridge.id === settings.cartridgeId)!;
  const chosenScope = SCOPES.find(scope => scope.id === settings.scopeId)!;
  return {
    distanceText: settings.isDistanceUnknown ? T.unknownDistance : UNITS.quantityText('distance', settings.distanceM, system),
    distanceSliderLabel: T.distanceSlider({ unit: UNITS.unitLabel('distance', system) }),
    unknownLock: lockOf('unknownDistance', unlocks),
    winds: (Object.keys(WIND_LABELS) as WindPreset[]).map(id => ({
      id,
      label: WIND_LABELS[id],
      line: '',
      lock: lockOf(id === 'gusty' ? 'gustyWind' : null, unlocks),
      isChosen: settings.wind === id,
    })),
    terrains: (Object.keys(TERRAIN_LABELS) as Terrain[]).map(id => ({
      id,
      label: TERRAIN_LABELS[id],
      line: terrainLine(id, system),
      lock: null,
      isChosen: settings.terrain === id,
    })),
    modes: (Object.keys(MODE_LABELS) as NotebookMode[]).map(id => ({
      id,
      label: T.mode({ label: MODE_LABELS[id], multiplier: modeMultiplier(id, false) }),
      line: '',
      lock: lockOf(MODE_OPENED_BY[id], unlocks),
      isChosen: settings.notebookMode === id,
    })),
    cartridges: CARTRIDGES.map(cartridge => ({
      id: cartridge.id,
      label: cartridge.name,
      line: T.cartridgeLine({
        mass: UNITS.valueText('bulletMass', cartridge.massG, system, system === 'metric' ? 1 : 0),
        velocity: UNITS.valueText('muzzleVelocity', cartridge.muzzleVelocityMps, system, 0),
        ballisticCoefficient: cartridge.ballisticCoefficient,
      }),
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
    rifles: [
      { id: 'course', label: RIFLE_TEXTS.course, line: '', lock: null, isChosen: !isOwnRifle },
      {
        id: 'own',
        label: activeProfile ? RIFLE_TEXTS.own({ name: activeProfile.name }) : RIFLE_TEXTS.ownShort,
        line: '',
        lock: activeProfile ? null : RIFLE_TEXTS.ownMissing,
        isChosen: isOwnRifle,
      },
    ],
    isOwnRifle,
  };
}

function terrainLine(terrain: Terrain, system: UnitSystem): string {
  const preset = TERRAIN_PRESETS[terrain];
  const lines = T.terrainLines;
  switch (terrain) {
    case 'plain':
      return lines.plain();
    case 'mountains': {
      const [lowDeg, highDeg] = preset.conditions.lookAngleRangeDeg!;
      return lines.mountains({
        angle: `${lowDeg}${ANGLE_RANGE_SEPARATOR}${highDeg}`,
        altitude: UNITS.rangeText('altitude', preset.conditions.altitudeRangeM!, system),
        upTo: UNITS.quantityText('distance', preset.toM, system),
      });
    }
    case 'long-range':
      return lines['long-range']({ range: UNITS.rangeText('distance', [preset.fromM, preset.toM], system) });
  }
}

export function instructorLineText(correction: Correction): string {
  const up = `${correction.upMrad >= 0 ? '↑' : '↓'} ${decimal(Math.abs(correction.upMrad), 1)}`;
  const side = Math.abs(correction.rightMrad) < NOTHING_TO_SHOW_MIL ? '' : ` ${correction.rightMrad > 0 ? '→' : '←'} ${decimal(Math.abs(correction.rightMrad), 1)}`;
  return T.instructorLine({ correction: `${up}${side}` });
}

