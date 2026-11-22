import type { CartridgeId } from '../../core/types';
import type { ExerciseGoalTexts, ExerciseId } from '../../sim/course';
import type { ScopeId } from '../../sim/scope-model';
import { decimal, percent } from '../format';

interface MagnificationRange {
  magnificationMin: number;
  magnificationMax: number;
}

const zoomText = (scope: MagnificationRange): string => `${scope.magnificationMin}–${scope.magnificationMax}×`;

export const content = {
  rifleName: '“Rubezh-1”, .308 class',
  cartridges: {
    A: { name: 'Cartridge A', blurb: 'light fast bullet' },
    B: { name: 'Cartridge B', blurb: 'medium bullet' },
    C: { name: 'Cartridge C', blurb: 'heavy bullet, high BC' },
  } satisfies Record<CartridgeId, { name: string; blurb: string }>,
  scopes: {
    'course-tree': (scope: MagnificationRange) => `Course ${zoomText(scope)} · Tree`,
    'course-dot': (scope: MagnificationRange) => `Course ${zoomText(scope)} · MIL-dot`,
    moa: (scope: MagnificationRange) => `MOA ${zoomText(scope)}`,
    tree: (scope: MagnificationRange) => `Long-range ${zoomText(scope)} · Tree`,
    dot: (scope: MagnificationRange) => `Old ${zoomText(scope)} · MIL-dot · 2nd focal plane`,
  } satisfies Record<ScopeId, (scope: MagnificationRange) => string>,
  freePlayTitle: 'Free play',
  builtInProfileName: 'custom',
  profilePresets: {
    '223-77': '.223 · 77 gr',
    '65-140': '6.5 mm · 140 gr',
    '308-175': '.308 · 175 gr',
    '338-300': '.338 · 300 gr',
    '6-105': '6 mm · 105 gr',
    '300-215': '.300 Magnum · 215 gr',
  },
  exerciseTitles: {
    '00': 'Rifle and scope',
    '01': 'First clicks',
    '02': 'Zero and cold bore',
    '03': 'Breathing and trigger',
    '04': 'Wind flag on the berm',
    '05': 'Distances: DOPE and rangefinder',
    '06': 'Wind clock',
    '07': 'Cold morning',
    '08': 'Three cartridges',
    '09': 'Wind flags down range',
    '10': (p: { distance: number }) => `Zeroing at ${p.distance}`,
    '11': 'Moving patrol',
    '12': 'Field test',
    '13': 'Mountain slope',
    '14': 'Long-range line',
  },
  goals: {
    '00': { second: '', first: null },
    '01': { second: 'dial exactly the total on the first try', first: null },
    '02': (p: { groupFirstShot: number; groupLastShot: number; groupMaxMil: number; controlMaxMil: number }): ExerciseGoalTexts => ({
      second: `group ${p.groupFirstShot}–${p.groupLastShot} ≤ ${decimal(p.groupMaxMil)} MIL`,
      first: `cold bore with no jerked trigger, check shot ≤ ${decimal(p.controlMaxMil)} MIL from the aiming point`,
    }),
    '03': (p: { targets: number }): ExerciseGoalTexts => ({ second: 'not a single jerked trigger', first: `all ${p.targets} with the breath held in the window` }),
    '04': { second: 'wind speed entered without error', first: 'wind accounted for on every shot' },
    '05': (p: { secondClassTolerance: number; firstClassTolerance: number }): ExerciseGoalTexts => ({
      second: `range ±${percent(p.secondClassTolerance)} on all`,
      first: `range ±${percent(p.firstClassTolerance)} on all`,
    }),
    '06': { second: 'calculation check with no “error” on all', first: '“exact” on all' },
    '07': { second: 'conditions accounted for on all', first: '“exact” on all' },
    '08': { second: 'correct calculation for all three cartridges', first: '“exact” for all three' },
    '09': { second: 'not a single SIDE error', first: '“exact” on all' },
    '10': (p: { callToleranceMil: number }): ExerciseGoalTexts => ({
      second: 'every first-shot miss finished with the second',
      first: `call accurate (≤ ${decimal(p.callToleranceMil)} MIL) on all`,
    }),
    '11': (p: { minTargetsHit: number; targets: number }): ExerciseGoalTexts => ({
      second: `≥ ${p.minTargetsHit} of ${p.targets} and never a lead behind the target`,
      first: `${p.targets} of ${p.targets}, ambush targets all with the first shot`,
    }),
    '12': { second: 'without the reference', first: 'MANUAL hard' },
    '13': { second: '“Shot angle” step without error on all', first: '“exact” on all' },
    '14': { second: 'spin drift and Coriolis without error on all', first: '“exact” on all' },
  },
  novelties: {
    '00': 'introduction: parts of the rifle and scope, the turret moves the point of impact, magnification, reticles',
    '01': 'turrets, clicks, DOPE as a hint; trigger is a tap; bolt cycles itself',
    '02': 'shot call (set by the game), group',
    '03': 'full trigger press with pressure, breathing, L-track bolt',
    '04': 'wind, weather station, wind flag at the berm',
    '05': 'unknown distance, milling with the reticle',
    '06': 'MANUAL easy mode',
    '07': null,
    '08': 'cartridge change within the exercise',
    '09': 'different wind along the range, mirage',
    '10': 'MANUAL hard, shot call by the player, pencil in the DOPE',
    '11': 'moving targets, lead with the reticle, “Lead” step in the notebook',
    '12': null,
    '13': 'shot angle: elevation × cos, zero angle Z; range altitude',
    '14': 'spin drift, Coriolis and Eötvös: latitude and azimuth',
  } satisfies Record<ExerciseId, string | null>,
  exerciseTerms: {
    '00': ['rifle', 'scope', 'reticle', 'magnification', 'focal plane'],
    '01': ['click', 'MIL', 'MOA', 'turret', 'DOPE', 'ZERO STOP'],
    '02': ['zero', 'MPI', 'group', 'cold bore', 'call'],
    '03': ['breathing', 'trigger', 'bolt', 'pulse'],
    '04': ['wind', 'clock method', 'wind flag', 'weather station', 'crosswind component'],
    '05': ['milling', 'mil formula', 'DOPE row'],
    '06': ['clock value', 'wind constant', 'MANUAL'],
    '07': ['air density', 'standard conditions', 'conditions correction'],
    '08': ['ballistic coefficient', 'energy', 'velocity spread', 'cartridge card'],
    '09': ['wind zones', 'average wind', 'mirage'],
    '10': ['second-shot correction', 'own card', 'call'],
    '11': ['lead', 'tracking', 'ambush', 'time of flight'],
    '12': [],
    '13': ['shot angle', 'zero angle', 'cosine rule', 'range altitude'],
    '14': ['spin drift', 'twist', 'Coriolis', 'Eötvös'],
  } satisfies Record<ExerciseId, readonly string[]>,
};
