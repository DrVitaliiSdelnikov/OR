import type { DragModel } from '../../core/types';
import type { CheckErrorType } from '../../core/calc-check';
import type { CauseKind, MainCause } from '../../sim/miss-breakdown';
import type { ReticleMarkKind } from '../../sim/reticle';
import type { ReticleKind } from '../../sim/scope-model';
import { decimal } from '../format';
import type { TermTexts, TextbookChapter } from '../ru/textbook';

export type { TermTexts, TextbookChapter };

const CHAPTERS: readonly string[] = [
  'Rifle',
  'Scope',
  'Reticle',
  'Units',
  'Cartridge',
  'Ballistics',
  'Wind',
  'Range',
  'Atmosphere',
  'Shooter',
  'Moving targets',
  'Breakdown',
  'Angle and Earth rotation',
];

const clickCount = (clicks: number): string => `${clicks} cl.`;
const roundedDecimal = (value: number, maxDigits: number): string => decimal(Number(value.toFixed(maxDigits)));
const arrow = (value: number, positive: string, negative: string): string => (value >= 0 ? positive : negative);

const terms = (p: { rifleName: string; zero: string; flags: string; flagsAnd: string }) =>
  ({
    rifle: {
      term: 'rifle',
      forms: ['rifles', 'rifle’s'],
      chapter: 'Rifle',
      phrase: `Training rifle ${p.rifleName}: barrel, bolt, 5-round magazine and trigger. Zeroed at ${p.zero}.`,
      places: ['firing line'],
      related: ['bolt', 'scope', 'zero'],
    },
    coldBore: {
      term: 'cold bore',
      forms: ['cold-bore', 'cold bore shot', 'cold bore shots'],
      chapter: 'Rifle',
      phrase: 'The first shot from a cold, clean barrel lands slightly away from the rest. It is a property of the rifle — you don’t correct it with the turret, you remember it.',
      places: ['first shot of every exercise from exercise 02', 'breakdown · grey “cold bore” chip'],
      related: ['group', 'MPI', 'zero'],
    },
    bolt: {
      term: 'bolt',
      forms: ['bolts', 'bolt’s'],
      chapter: 'Rifle',
      phrase: 'After the shot the bolt is opened and closed: the case is ejected, a new round is in the chamber. While the bolt is open, the trigger does not work.',
      places: ['firing line · bolt track'],
      related: ['trigger', 'rifle'],
    },
    scope: {
      term: 'scope',
      forms: ['scopes', 'scope’s'],
      chapter: 'Scope',
      phrase: 'Optical scope: the objective gathers light, the eyepiece shows the picture, the reticle sits inside. The turrets move the reticle relative to the barrel.',
      places: ['firing line'],
      related: ['reticle', 'magnification', 'turret'],
    },
    magnification: {
      term: 'magnification',
      forms: ['magnifications'],
      chapter: 'Scope',
      phrase: 'How many times the scope brings the target closer. At low magnification the field of view is wider and the target is easier to find; at high magnification the target is bigger and the wobble is more visible.',
      places: ['firing line · magnification wheel'],
      related: ['scope', 'focal plane'],
    },
    focalPlane: {
      term: 'focal plane',
      forms: ['focal planes'],
      chapter: 'Scope',
      phrase: 'Where the reticle sits inside the scope. In the first focal plane the reticle grows with the target, and the marks are true at any magnification. In the second the reticle always stays the same size — the marks are true at one magnification only.',
      places: ['course scope — first plane', 'free play · second focal plane scope after exercise 12'],
      related: ['reticle', 'magnification', 'milling'],
    },
    click: {
      term: 'click',
      forms: ['clicks', 'click’s'],
      chapter: 'Scope',
      phrase: 'One click of the turret: 0.1 MIL. That is 1 cm at 100 m.',
      formula: {
        line: 'N = C / V',
        variables: [
          { symbol: 'N', meaning: 'number of clicks, to the nearest whole' },
          { symbol: 'C', meaning: 'correction, MIL' },
          { symbol: 'V', meaning: 'click value, 0.1 MIL' },
        ],
      },
      places: ['firing line · turrets', 'notebook · TOTAL tab'],
      related: ['turret', 'MIL', 'ZERO STOP'],
    },
    turret: {
      term: 'turret',
      forms: ['turrets', 'turret’s'],
      chapter: 'Scope',
      phrase: 'The scope knobs: ELEV on top, WIND on the side. ELEV raises the impact for the range, WIND moves it sideways for the wind.',
      places: ['firing line · ELEV and WIND turrets'],
      related: ['click', 'ZERO STOP', 'DOPE'],
    },
    zeroStop: {
      term: 'ZERO STOP',
      chapter: 'Scope',
      phrase: 'A stop on the ELEV turret at the zero mark: you can’t dial below it, and you can always return to zero by feel.',
      places: ['firing line · ELEV turret'],
      related: ['turret', 'zero'],
    },
    reticle: {
      term: 'reticle',
      forms: ['reticles', 'reticle’s'],
      chapter: 'Reticle',
      phrase: 'The marks in the scope. The Tree has a scale downward for holdover and sideways for wind; the MIL-dot has dots every 1 MIL. With the reticle you measure the target and hold a correction without the turret.',
      places: ['Tree — exercises 00–05', 'MIL-dot — from exercise 06'],
      related: ['milling', 'focal plane', 'MIL'],
    },
    milling: {
      term: 'milling',
      forms: ['milled'],
      chapter: 'Reticle',
      phrase: 'Measuring the target with the reticle: how many MIL its known size takes up. Then the range follows from the mil formula.',
      places: ['notebook · DISTANCE tab'],
      related: ['mil formula', 'reticle'],
    },
    mil: {
      term: 'MIL',
      chapter: 'Units',
      phrase: 'A milliradian — the angle at which 1 m is seen from 1000 m. 0.1 MIL is 1 cm at 100 m. Corrections, the reticle and the turrets in the course are all in MIL.',
      formula: {
        line: 'cm = MIL × D / 10',
        variables: [
          { symbol: 'cm', meaning: 'size on the target, centimeters' },
          { symbol: 'MIL', meaning: 'angle in milliradians' },
          { symbol: 'D', meaning: 'distance, m' },
        ],
      },
      places: ['the whole course'],
      related: ['MOA', 'click'],
    },
    moa: {
      term: 'MOA',
      chapter: 'Units',
      phrase: 'Minute of angle, 1/60 of a degree: about 2.9 cm at 100 m. A MOA scope is in free play; in the course everything is in MIL.',
      formula: {
        line: 'MOA = MIL × 3.44',
        variables: [
          { symbol: 'MOA', meaning: 'angle in minutes' },
          { symbol: 'MIL', meaning: 'angle in milliradians' },
        ],
      },
      places: ['free play · MOA scope after exercise 06'],
      related: ['MIL', 'click'],
    },
    cartridgeCard: {
      term: 'cartridge card',
      forms: ['cartridge cards'],
      chapter: 'Cartridge',
      phrase: 'The cartridge’s passport: bullet mass and velocity, ballistic coefficient, velocity spread.',
      places: ['exercise 08 · magazine change', 'free play · cartridge choice'],
      related: ['ballistic coefficient', 'energy', 'velocity spread'],
    },
    ballisticCoefficient: {
      term: 'ballistic coefficient',
      forms: ['ballistic coefficients'],
      chapter: 'Cartridge',
      phrase: 'How streamlined the bullet is (BC on the G7 model). The higher it is, the slower the bullet loses velocity: it drops less and drifts less in the wind.',
      places: ['cartridge card'],
      related: ['cartridge card', 'wind constant'],
    },
    energy: {
      term: 'energy',
      forms: ['energies'],
      chapter: 'Cartridge',
      phrase: 'How hard the bullet hits. At the muzzle the three cartridges are almost equal, but at range the bullet with the higher BC keeps more.',
      formula: {
        line: 'E = m × v² / 2',
        variables: [
          { symbol: 'E', meaning: 'muzzle energy, J' },
          { symbol: 'm', meaning: 'bullet mass, kg' },
          { symbol: 'v', meaning: 'muzzle velocity, m/s' },
        ],
      },
      places: ['cartridge card'],
      related: ['ballistic coefficient', 'cartridge card'],
    },
    velocitySpread: {
      term: 'velocity spread',
      forms: ['velocity spreads'],
      chapter: 'Cartridge',
      phrase: 'Bullets of one lot leave the barrel at slightly different velocities. A slow one drops lower — at range the group stretches vertically.',
      places: ['cartridge card', 'breakdown · “cartridge spread” chip'],
      related: ['group', 'cartridge card'],
    },
    dope: {
      term: 'DOPE',
      chapter: 'Ballistics',
      phrase: 'The correction table for your rifle and cartridge: for each distance — ELEV in MIL and clicks, time of flight, wind constant, corrections for cold and pressure.',
      places: ['notebook · DOPE tab', 'log · cards'],
      related: ['DOPE row', 'zero', 'turret', 'own card'],
    },
    dopeRow: {
      term: 'DOPE row',
      forms: ['DOPE rows'],
      chapter: 'Ballistics',
      phrase: 'One row of the card — for one distance. If the distance falls between rows, the value is taken proportionally between the neighbors.',
      places: ['notebook · DOPE tab'],
      related: ['DOPE', 'mil formula'],
    },
    zero: {
      term: 'zero',
      forms: ['zeroed', 'zeroing'],
      chapter: 'Ballistics',
      phrase: `The distance at which, with the turrets at zero, the bullet hits the center. The course rifle’s is ${p.zero}: farther out the bullet drops, and ELEV is taken from the DOPE.`,
      places: ['exercise 02 · zeroing a knocked-off scope'],
      related: ['ZERO STOP', 'DOPE', 'MPI'],
    },
    manualMode: {
      term: 'MANUAL',
      chapter: 'Ballistics',
      phrase: 'The notebook mode where you calculate the correction yourself: distance → DOPE row → conditions → wind → result for the turrets.',
      formula: {
        line: 'ELEV = DOPE + ΔELEV;  WIND = W',
        variables: [
          { symbol: 'ELEV', meaning: 'turret up, MIL' },
          { symbol: 'DOPE', meaning: 'value from the card row' },
          { symbol: 'ΔELEV', meaning: 'conditions correction' },
          { symbol: 'WIND', meaning: 'turret sideways, MIL' },
          { symbol: 'W', meaning: 'wind correction' },
        ],
      },
      places: ['notebook · MANUAL mode'],
      related: ['DOPE', 'conditions correction', 'wind'],
    },
    timeOfFlight: {
      term: 'time of flight',
      forms: ['times of flight', 'flight time'],
      chapter: 'Ballistics',
      phrase: 'How long the bullet flies to the target — the t column of the card. Needed for lead; the gong’s ring comes even later — the sound has to travel back too.',
      places: ['notebook · DOPE tab, column t'],
      related: ['lead', 'DOPE'],
    },
    wind: {
      term: 'wind',
      forms: ['winds', 'wind’s'],
      chapter: 'Wind',
      phrase: 'A crosswind pushes the bullet aside. The correction is taken against the drift with the WIND turret or the reticle.',
      formula: {
        line: 'W = V⊥ × D / K',
        variables: [
          { symbol: 'W', meaning: 'wind correction, MIL' },
          { symbol: 'V⊥', meaning: 'cross part of the wind, m/s (speed × clock value)' },
          { symbol: 'D', meaning: 'distance to the target, m' },
          { symbol: 'K', meaning: 'wind constant from the DOPE row' },
        ],
      },
      places: ['notebook · WIND tab'],
      related: ['crosswind component', 'wind constant', 'clock method'],
    },
    clockRule: {
      term: 'clock method',
      forms: ['clock methods'],
      chapter: 'Wind',
      phrase: 'Wind direction is named by the clock face: 12 — from the target into your face, 6 — at your back, 3 — from the right, 9 — from the left. Wind from the left pushes right — hold left.',
      places: ['firing line · weather station', 'notebook · wind clock'],
      related: ['clock value', 'crosswind component'],
    },
    flag: {
      term: 'wind flag',
      forms: ['wind flags', 'flags', 'flag'],
      chapter: 'Wind',
      phrase: 'Flags along the range show the wind where the bullet flies. The stronger the wind, the bigger the angle.',
      places: [`firing line · flags ${p.flags}`],
      related: ['wind zones', 'weather station'],
    },
    weatherStation: {
      term: 'weather station',
      forms: ['weather stations', 'station', 'station’s'],
      chapter: 'Wind',
      phrase: 'The station by the shooter measures the wind at the firing line: speed and clock. Farther down the range the wind can be different.',
      places: ['firing line · weather station', 'notebook · WIND tab'],
      related: ['wind flag', 'clock method'],
    },
    crosswind: {
      term: 'crosswind component',
      forms: ['crosswind components', 'crosswind'],
      chapter: 'Wind',
      phrase: 'The part of the wind that blows across the range. Only this part pushes the bullet.',
      formula: {
        line: 'V⊥ = V × share',
        variables: [
          { symbol: 'V⊥', meaning: 'crosswind, m/s' },
          { symbol: 'V', meaning: 'wind speed from the station, m/s' },
          { symbol: 'share', meaning: 'clock value' },
        ],
      },
      places: ['notebook · WIND tab'],
      related: ['clock value', 'wind'],
    },
    clockShare: {
      term: 'clock value',
      forms: ['clock values'],
      chapter: 'Wind',
      phrase: 'How much of the wind works across the range. The quick army estimate is “diagonal is half”, but in MANUAL use the table.',
      places: ['notebook · wind clock', 'formula reference'],
      related: ['clock method', 'crosswind component'],
    },
    windConstant: {
      term: 'wind constant',
      forms: ['wind constants'],
      chapter: 'Wind',
      phrase: 'The number K from the DOPE row for the wind formula. It falls with distance: the bullet slows down and spends longer in the wind.',
      places: ['notebook · DOPE tab, column K'],
      related: ['wind', 'DOPE row', 'ballistic coefficient'],
    },
    windZones: {
      term: 'wind zones',
      forms: ['wind zone'],
      chapter: 'Wind',
      phrase: `The range is split into zones: at the shooter, at the flags ${p.flagsAnd}. Each has its own wind, and a zone’s weight depends on the distance.`,
      places: ['notebook · WIND tab, exercises with zones'],
      related: ['average wind', 'wind flag'],
    },
    averageWind: {
      term: 'average wind',
      forms: ['average winds'],
      chapter: 'Wind',
      phrase: 'One crosswind instead of several zones: each zone counts with its own weight.',
      formula: {
        line: 'V⊥avg = Σ weight × V⊥',
        variables: [
          { symbol: 'V⊥avg', meaning: 'average crosswind, m/s' },
          { symbol: 'weight', meaning: 'zone share from the DOPE row' },
          { symbol: 'V⊥', meaning: 'zone crosswind, m/s' },
        ],
      },
      places: ['notebook · WIND tab, exercises with zones'],
      related: ['wind zones', 'wind'],
    },
    mirage: {
      term: 'mirage',
      forms: ['mirages'],
      chapter: 'Wind',
      phrase: 'The shimmer of heated air in the scope. Mirage flows with the wind: its lean shows the direction and strength of a light wind.',
      places: ['scope · far targets'],
      related: ['wind zones', 'wind flag'],
    },
    milFormula: {
      term: 'mil formula',
      forms: ['mil formulas'],
      chapter: 'Range',
      phrase: 'Range from the target’s size in the reticle. It errs along with the eye: on contrast, flat ground and slopes the target looks closer or farther.',
      formula: {
        line: 'D = size × 1000 / mil',
        variables: [
          { symbol: 'D', meaning: 'range, m' },
          { symbol: 'size', meaning: 'known target size, m' },
          { symbol: 'mil', meaning: 'how many MIL the target took up in the reticle' },
        ],
      },
      places: ['notebook · DISTANCE tab'],
      related: ['milling', 'DOPE row'],
    },
    airDensity: {
      term: 'air density',
      forms: ['air densities'],
      chapter: 'Atmosphere',
      phrase: 'Cold, dense air slows the bullet more — it drops lower. Warm, thin air does the opposite.',
      places: ['notebook · CONDITIONS tab'],
      related: ['standard conditions', 'conditions correction'],
    },
    standardAtmosphere: {
      term: 'standard conditions',
      forms: ['reference'],
      chapter: 'Atmosphere',
      phrase: 'The conditions the DOPE card was calculated for: +15 °C and 1013 hPa. If the weather is the same, the conditions correction is zero.',
      places: ['DOPE card', 'notebook · CONDITIONS tab'],
      related: ['conditions correction', 'air density'],
    },
    atmosphereCorrection: {
      term: 'conditions correction',
      forms: ['conditions corrections'],
      chapter: 'Atmosphere',
      phrase: 'An addition to ELEV when the weather differs from the standard. Colder or higher pressure — dial higher.',
      formula: {
        line: 'ΔELEV = (15 − T) / 10 × C + (P − 1013) / 10 × Pc',
        variables: [
          { symbol: 'ΔELEV', meaning: 'addition to ELEV, MIL' },
          { symbol: 'T', meaning: 'temperature, °C' },
          { symbol: 'C', meaning: '“10 °C colder” column of the DOPE row' },
          { symbol: 'P', meaning: 'pressure, hPa' },
          { symbol: 'Pc', meaning: '“pressure +10 hPa” column of the DOPE row' },
        ],
      },
      places: ['notebook · CONDITIONS tab'],
      related: ['standard conditions', 'MANUAL'],
    },
    breathing: {
      term: 'breathing',
      forms: ['breath'],
      chapter: 'Shooter',
      phrase: 'Shoot in the pause after exhaling: the chest is still, the reticle sways less.',
      places: ['firing line · breath button'],
      related: ['pulse', 'trigger'],
    },
    trigger: {
      term: 'trigger',
      forms: ['triggers', 'trigger’s'],
      chapter: 'Shooter',
      phrase: 'Press smoothly until the shot breaks, without jerking. A jerk throws the bullet off.',
      places: ['firing line · trigger button'],
      related: ['breathing', 'call', 'bolt'],
    },
    pulse: {
      term: 'pulse',
      forms: ['pulses', 'heartbeat'],
      chapter: 'Shooter',
      phrase: 'The heart nudges the reticle in beats. Shoot between beats; after running or holding your breath the pulse is faster.',
      places: ['firing line · pulse in the scope'],
      related: ['breathing', 'trigger'],
    },
    call: {
      term: 'call',
      forms: ['calls', 'called'],
      chapter: 'Shooter',
      phrase: 'Right after the shot, mark where the reticle was at the moment the trigger broke. The call separates a shooter error from a correction error.',
      places: ['breakdown · call next to the hole'],
      related: ['trigger', 'second-shot correction', 'group'],
    },
    lead: {
      term: 'lead',
      forms: ['leads'],
      chapter: 'Moving targets',
      phrase: 'While the bullet flies, the target moves on. You shoot where the target will be — with the reticle ahead of it.',
      formula: {
        line: 'L = V⊥ × t / D × 1000',
        variables: [
          { symbol: 'L', meaning: 'lead, MIL' },
          { symbol: 'V⊥', meaning: 'target speed across, m/s' },
          { symbol: 't', meaning: 'time of flight from the DOPE row, s' },
          { symbol: 'D', meaning: 'distance, m' },
        ],
      },
      places: ['notebook · “Lead” step'],
      related: ['time of flight', 'tracking', 'ambush'],
    },
    tracking: {
      term: 'tracking',
      forms: ['track'],
      chapter: 'Moving targets',
      phrase: 'Move the reticle with the target, holding the lead, and fire without stopping the movement.',
      places: ['exercise 11 · moving patrol'],
      related: ['lead', 'ambush'],
    },
    ambush: {
      term: 'ambush',
      forms: ['ambushes'],
      chapter: 'Moving targets',
      phrase: 'Hold the reticle still on the target’s path and fire when the target reaches the lead.',
      places: ['exercise 11 · moving patrol'],
      related: ['lead', 'tracking'],
    },
    group: {
      term: 'group',
      forms: ['groups', 'group’s'],
      chapter: 'Breakdown',
      phrase: 'Several holes with one correction. The shape shows the cause: a vertical string — velocity spread or hold, a sideways shift — wind.',
      places: ['breakdown · target diagram', 'exercise result'],
      related: ['MPI', 'velocity spread', 'cold bore'],
    },
    meanPointOfImpact: {
      term: 'MPI',
      chapter: 'Breakdown',
      phrase: 'Mean point of impact — the center of the group. The correction is moved by the MPI, not by a single hole.',
      places: ['exercise 02 · zeroing', 'breakdown · target diagram'],
      related: ['group', 'zero', 'second-shot correction'],
    },
    secondShotCorrection: {
      term: 'second-shot correction',
      forms: ['second-shot corrections'],
      chapter: 'Breakdown',
      phrase: 'You saw where the first shot went — move the turrets back by the same amount.',
      places: ['breakdown · “recalculate and repeat”'],
      related: ['MPI', 'call', 'own card'],
    },
    ownCard: {
      term: 'own card',
      forms: ['own cards'],
      chapter: 'Breakdown',
      phrase: 'Pencil notes in the DOPE from your own shots: if at a distance it came out different from the card, write down how it came out.',
      places: ['breakdown · pencil “to DOPE”', 'log · cards'],
      related: ['DOPE', 'second-shot correction'],
    },
    lookAngle: {
      term: 'shot angle',
      forms: ['shot angles'],
      chapter: 'Angle and Earth rotation',
      phrase: 'The angle between the line of sight and the horizon: target higher — “+”, lower — “−”. Up or down, the correction is the same: only the incline matters to the bullet.',
      formula: { line: 'θ', variables: [{ symbol: 'θ', meaning: 'shot angle, degrees' }] },
      places: ['firing line · conditions line “∠ ±N°”', 'notebook · “Shot angle” step'],
      related: ['cosine rule', 'zero angle'],
    },
    zeroAngle: {
      term: 'zero angle',
      forms: ['zero angles'],
      chapter: 'Angle and Earth rotation',
      phrase: `With a zero at ${p.zero}, the barrel points slightly above the line of sight. On an incline the whole shot tilts, so the zero angle enters the calculation.`,
      formula: { line: 'Z', variables: [{ symbol: 'Z', meaning: 'zero angle from the DOPE card header, MIL' }] },
      places: ['DOPE card · header', 'notebook · “Shot angle” step'],
      related: ['cosine rule', 'zero'],
    },
    cosineRule: {
      term: 'cosine rule',
      forms: ['cosine rules'],
      chapter: 'Angle and Earth rotation',
      phrase: 'On an incline gravity pulls the bullet across the line of sight more weakly, and the bullet drops less. The DOPE elevation together with the zero angle is multiplied by the cos of the angle.',
      formula: {
        line: 'E∠ = (E + Z) × cos θ − Z',
        variables: [
          { symbol: 'E∠', meaning: 'elevation on the incline, MIL' },
          { symbol: 'E', meaning: 'elevation from the DOPE row, MIL' },
          { symbol: 'Z', meaning: 'zero angle, MIL' },
          { symbol: 'θ', meaning: 'shot angle' },
        ],
      },
      places: ['notebook · “Shot angle” step'],
      related: ['shot angle', 'zero angle', 'DOPE'],
    },
    rangeAltitude: {
      term: 'range altitude',
      forms: ['altitude'],
      chapter: 'Angle and Earth rotation',
      phrase: 'In the mountains the pressure is lower, the air is thinner, the bullet loses less velocity and drops less. The station shows the local pressure, and that is what goes into the conditions calculation.',
      places: ['exercise 13 · mountain slope', 'notebook · “Conditions” step'],
      related: ['air density', 'conditions correction'],
    },
    spinDrift: {
      term: 'spin drift',
      forms: ['spin drifts'],
      chapter: 'Angle and Earth rotation',
      phrase: 'The rifling spins the bullet, and in flight it drifts toward the spin: with right-hand rifling — to the right. The farther, the more. The amount is in the SPIN column of the DOPE card.',
      formula: { line: 'SPIN', variables: [{ symbol: 'SPIN', meaning: 'DOPE card column, MIL' }] },
      places: ['DOPE card · SPIN column', 'notebook · “Spin drift” step'],
      related: ['twist', 'Coriolis'],
    },
    twist: {
      term: 'twist',
      forms: ['twists', 'twist rate'],
      chapter: 'Angle and Earth rotation',
      phrase: 'The rifling pitch: over how many inches of barrel the bullet makes one turn. The direction of the rifling sets the side of the spin drift.',
      places: ['rifle · barrel'],
      related: ['spin drift'],
    },
    coriolis: {
      term: 'Coriolis',
      forms: ['Coriolis effect', 'Coriolis’s'],
      chapter: 'Angle and Earth rotation',
      phrase: 'While the bullet flies, the Earth turns beneath it. In the northern hemisphere the bullet drifts right, in the southern — left; stronger near the poles.',
      formula: {
        line: 'K = 0.0729 × t × sin φ',
        variables: [
          { symbol: 'K', meaning: 'sideways correction, MIL' },
          { symbol: '0.0729', meaning: 'Earth rotation × 1000' },
          { symbol: 't', meaning: 'time of flight from the DOPE row, s' },
          { symbol: 'φ', meaning: 'latitude' },
        ],
      },
      places: ['firing line · conditions line “NN° N”', 'notebook · “Coriolis” step'],
      related: ['Eötvös', 'time of flight', 'spin drift'],
    },
    eotvos: {
      term: 'Eötvös',
      forms: ['Eötvös effect', 'Eötvös’s'],
      chapter: 'Angle and Earth rotation',
      phrase: 'The vertical part of the Earth’s rotation: a shot to the east goes slightly higher, to the west — lower. Fractions of a click, but noticeable at 1000 m.',
      formula: {
        line: 'Ev = 0.0729 × t × cos φ × sin A',
        variables: [
          { symbol: 'Ev', meaning: 'vertical correction, MIL' },
          { symbol: 't', meaning: 'time of flight, s' },
          { symbol: 'φ', meaning: 'latitude' },
          { symbol: 'A', meaning: 'shot azimuth' },
        ],
      },
      places: ['firing line · conditions line “az. N°”', 'notebook · “Eötvös” step'],
      related: ['Coriolis', 'time of flight'],
    },
  }) satisfies Record<string, TermTexts>;

export type CatalogTermId = keyof ReturnType<typeof terms>;

const imperialTerms: Partial<Record<CatalogTermId, Partial<TermTexts>>> = {
  click: { phrase: 'One click of the turret: 0.1 MIL. That is 0.36″ at 100 yards.' },
  mil: {
    phrase: 'A milliradian — the angle at which 1 yard is seen from 1000 yards. 0.1 MIL is 0.36″ at 100 yards. Corrections, the reticle and the turrets in the course are all in MIL.',
    formula: {
      line: 'in = MIL × D / 27.78',
      variables: [
        { symbol: 'in', meaning: 'size on the target, inches' },
        { symbol: 'MIL', meaning: 'angle in milliradians' },
        { symbol: 'D', meaning: 'distance, yards' },
      ],
    },
  },
  moa: { phrase: 'Minute of angle, 1/60 of a degree: about 1.05″ at 100 yards. A MOA scope is in free play; in the course everything is in MIL.' },
  energy: {
    formula: {
      line: 'E = m × v² / 450,240',
      variables: [
        { symbol: 'E', meaning: 'muzzle energy, ft-lb' },
        { symbol: 'm', meaning: 'bullet mass, grains' },
        { symbol: 'v', meaning: 'muzzle velocity, ft/s' },
      ],
    },
  },
  wind: {
    formula: {
      line: 'W = V⊥ × D / K',
      variables: [
        { symbol: 'W', meaning: 'wind correction, MIL' },
        { symbol: 'V⊥', meaning: 'cross part of the wind, mph (speed × clock value)' },
        { symbol: 'D', meaning: 'distance to the target, yards' },
        { symbol: 'K', meaning: 'wind constant from the DOPE row' },
      ],
    },
  },
  crosswind: {
    formula: {
      line: 'V⊥ = V × share',
      variables: [
        { symbol: 'V⊥', meaning: 'crosswind, mph' },
        { symbol: 'V', meaning: 'wind speed from the station, mph' },
        { symbol: 'share', meaning: 'clock value' },
      ],
    },
  },
  averageWind: {
    formula: {
      line: 'V⊥avg = Σ weight × V⊥',
      variables: [
        { symbol: 'V⊥avg', meaning: 'average crosswind, mph' },
        { symbol: 'weight', meaning: 'zone share from the DOPE row' },
        { symbol: 'V⊥', meaning: 'zone crosswind, mph' },
      ],
    },
  },
  milFormula: {
    formula: {
      line: 'D = size × 27.78 / mil',
      variables: [
        { symbol: 'D', meaning: 'range, yards' },
        { symbol: 'size', meaning: 'known target size, inches' },
        { symbol: 'mil', meaning: 'how many MIL the target took up in the reticle' },
      ],
    },
  },
  standardAtmosphere: {
    phrase: 'The conditions the DOPE card was calculated for: 59 °F and 29.92 inHg. If the weather is the same, the conditions correction is zero.',
  },
  atmosphereCorrection: {
    formula: {
      line: 'ΔELEV = (59 − T) / 10 × C + (P − 29.92) / 0.3 × Pc',
      variables: [
        { symbol: 'ΔELEV', meaning: 'addition to ELEV, MIL' },
        { symbol: 'T', meaning: 'temperature, °F' },
        { symbol: 'C', meaning: '“10 °F colder” column of the DOPE row' },
        { symbol: 'P', meaning: 'pressure, inHg' },
        { symbol: 'Pc', meaning: '“pressure +0.3″” column of the DOPE row' },
      ],
    },
  },
  lead: {
    formula: {
      line: 'L = 488.9 × V⊥ × t / D',
      variables: [
        { symbol: 'L', meaning: 'lead, MIL' },
        { symbol: 'V⊥', meaning: 'target speed across, mph' },
        { symbol: 't', meaning: 'time of flight from the DOPE row, s' },
        { symbol: 'D', meaning: 'distance, yards' },
      ],
    },
  },
  eotvos: { phrase: 'The vertical part of the Earth’s rotation: a shot to the east goes slightly higher, to the west — lower. Fractions of a click, but noticeable at 1000 yards.' },
};

const termExamples = {
  coldBore: (p: { rifleName: string; distance: string; upMil: number; up: string; rightMil: number; right: string }) =>
    `${p.rifleName} at ${p.distance}: ↑ ${decimal(p.upMil, 2)} MIL = ${p.up}, → ${decimal(p.rightMil, 2)} MIL = ${p.right}`,
  magnification: (p: { magnificationMin: number; magnificationMax: number }) => `course scope: ${p.magnificationMin}–${p.magnificationMax}×`,
  click: (p: { correctionMil: number; clickMil: number; exactClicks: number; clicks: number; distance: string; click: string }) =>
    `C = ${decimal(p.correctionMil)} MIL: N = ${decimal(p.correctionMil)} / ${decimal(p.clickMil)} = ${decimal(p.exactClicks, 1)} → ${clickCount(p.clicks)}; at ${p.distance} one click is ${p.click}`,
  turret: (p: { elevationTravelMil: number; windageTravelMil: number }) => `course scope: ELEV up to ${p.elevationTravelMil} MIL, WIND ±${p.windageTravelMil} MIL`,
  milling: (p: { gongSize: string; milledMil: number; range: string }) => `a ${p.gongSize} gong took up ${decimal(p.milledMil)} MIL in the reticle → ${p.range}`,
  mil: (p: { mil: number; distance: string; distanceNumber: string; divisor: string; size: string }) =>
    `${decimal(p.mil)} MIL at ${p.distance} = ${decimal(p.mil)} × ${p.distanceNumber} / ${p.divisor} = ${p.size}`,
  moa: (p: { mil: number; moa: number; moaClickMil: number }) => `${decimal(p.mil)} MIL = ${decimal(p.moa, 2)} MOA; a MOA scope click of ¼ MOA = ${decimal(p.moaClickMil, 3)} MIL`,
  cartridgeCard: (p: { name: string; mass: string; velocity: string; dragModel: DragModel; ballisticCoefficient: number }) =>
    `${p.name}: ${p.mass}, ${p.velocity}, ${p.dragModel} ${decimal(p.ballisticCoefficient, 3)}`,
  ballisticCoefficient: (p: { cartridges: readonly { name: string; ballisticCoefficient: number }[] }) => p.cartridges.map(cartridge => `${cartridge.name} — ${decimal(cartridge.ballisticCoefficient, 3)}`).join(' · '),
  energy: {
    metric: (p: { name: string; mass: number; velocity: number; energy: number }) => `${p.name}: ${decimal(p.mass, 4)} × ${p.velocity}² / 2 ≈ ${p.energy} J`,
    imperial: (p: { name: string; mass: number; velocity: number; energy: number }) => `${p.name}: ${p.mass} × ${p.velocity}² / 450,240 ≈ ${p.energy} ft-lb`,
  },
  velocitySpread: (p: { name: string; velocity: string }) => `${p.name}: ${p.velocity}`,
  dope: (p: { cartridgeName: string; distance: string; elevationMil: number; clicks: number }) => `${p.cartridgeName}, ${p.distance}: ELEV ${decimal(p.elevationMil, 1)} MIL = ${p.clicks} cl.`,
  dopeRow: (p: { cartridgeName: string; distance: string; lower: string; lowerMil: number; upper: string; upperMil: number; elevationMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance} — between ${decimal(p.lowerMil, 1)} (${p.lower}) and ${decimal(p.upperMil, 1)} (${p.upper}): ELEV ${decimal(p.elevationMil, 2)} MIL = ${p.clicks} cl.`,
  timeOfFlight: (p: { cartridgeName: string; distance: string; timeOfFlightS: number; soundDelayS: number }) =>
    `${p.cartridgeName}, ${p.distance}: t = ${decimal(p.timeOfFlightS, 2)} s, the ring comes ${decimal(p.soundDelayS, 1)} s after the shot`,
  wind: (p: { speed: string; speedNumber: string; clockHours: number; distance: string; distanceNumber: string; windConstant: number; correctionMil: number; clicks: number }) =>
    `wind ${p.speed} from ${p.clockHours} o’clock, ${p.distance}, cartridge B: W = ${p.speedNumber} × ${p.distanceNumber} / ${p.windConstant} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} left`,
  flag: (p: { angleDeg: number; degPerSpeed: string; speed: string }) => `flag deflected ${p.angleDeg}°: ${p.angleDeg} / ${p.degPerSpeed} = ${p.speed}`,
  crosswind: (p: { speed: string; speedNumber: string; clockHours: number; share: number; crosswind: string }) =>
    `${p.speed} from ${p.clockHours} o’clock: V⊥ = ${p.speedNumber} × ${decimal(p.share, 2)} = ${p.crosswind}`,
  clockShare: (p: { shares: readonly { clockHours: number; share: number }[] }) => p.shares.map(item => `${item.clockHours} o’clock → ${decimal(item.share, 2)}`).join(' · '),
  windConstant: (p: { cartridgeName: string; near: string; nearConstant: number; far: string; farConstant: number }) =>
    `${p.cartridgeName}: K = ${p.nearConstant} at ${p.near}, ${p.farConstant} at ${p.far}`,
  windZones: (p: { cartridgeName: string; distance: string; weights: readonly number[] }) =>
    `${p.cartridgeName}, ${p.distance} — weights: ${p.weights.map(weight => decimal(weight, 2)).join(' · ')}`,
  averageWind: (p: { distance: string; crosswinds: readonly number[]; speedUnit: string; weights: readonly number[]; average: string }) => {
    const parts = p.weights.map((weight, index) => `${decimal(weight, 2)} × ${p.crosswinds[index]}`).join(' + ');
    return `${p.distance}, zones ${p.crosswinds.join(' · ')} ${p.speedUnit}: ${parts} = ${p.average}`;
  },
  milFormula: (p: { gongSize: string; gongSizeNumber: string; factor: string; milledMil: number; range: string }) =>
    `gong ${p.gongSize}, ${decimal(p.milledMil)} MIL in the reticle: D = ${p.gongSizeNumber} × ${p.factor} / ${decimal(p.milledMil)} = ${p.range}`,
  atmosphereCorrection: (p: {
    cartridgeName: string;
    distance: string;
    temperature: string;
    pressure: string;
    colderTens: number;
    colderMil: number;
    pressureTens: number;
    pressureMil: number;
    correctionMil: number;
    clicks: number;
  }) =>
    `${p.cartridgeName}, ${p.distance}, ${p.temperature}, ${p.pressure}: ${roundedDecimal(p.colderTens, 1)} × ${decimal(p.colderMil, 2)} + ${decimal(p.pressureTens, 1)} × ${decimal(p.pressureMil, 2)} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} up`,
  lead: {
    metric: (p: { speed: string; speedNumber: string; distance: string; distanceNumber: string; timeOfFlightS: number; leadMil: number }) =>
      `walking ${p.speed} across, ${p.distance}: L = ${p.speedNumber} × ${decimal(p.timeOfFlightS, 2)} / ${p.distanceNumber} × 1000 = ${decimal(p.leadMil, 2)} MIL`,
    imperial: (p: { speed: string; speedNumber: string; distance: string; distanceNumber: string; timeOfFlightS: number; leadMil: number }) =>
      `walking ${p.speed} across, ${p.distance}: L = 488.9 × ${p.speedNumber} × ${decimal(p.timeOfFlightS, 2)} / ${p.distanceNumber} = ${decimal(p.leadMil, 2)} MIL`,
  },
  lookAngle: (p: { upDeg: number; downDeg: number; cos: number }) =>
    `“∠ +${p.upDeg}°” — target ${p.upDeg}° higher, “∠ −${p.downDeg}°” — lower. cos +${p.upDeg}° = cos −${p.downDeg}° = ${decimal(p.cos, 2)}: same correction`,
  zeroAngle: (p: { cartridgeName: string; zero: string; zeroAngleMil: number }) => `${p.cartridgeName}, zero at ${p.zero}: Z = ${decimal(p.zeroAngleMil, 2)} MIL`,
  cosineRule: (p: { cartridgeName: string; distance: string; angleDeg: number; elevationMil: number; zeroAngleMil: number; cos: number; inclinedMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance}, ∠ ${p.angleDeg}°: (${decimal(p.elevationMil, 1)} + ${decimal(p.zeroAngleMil, 2)}) × ${decimal(p.cos, 2)} − ${decimal(p.zeroAngleMil, 2)} = ${decimal(p.inclinedMil, 2)} MIL — ${clickCount(p.clicks)} less than the DOPE`,
  rangeAltitude: (p: { low: string; lowPressure: string; high: string; highPressure: string }) => `typical pressure: ${p.low} — ${p.lowPressure}, ${p.high} — ${p.highPressure}`,
  spinDrift: (p: { cartridgeName: string; distance: string; spinDriftMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance}: SPIN ${decimal(p.spinDriftMil, 2)} MIL right → WIND ${clickCount(p.clicks)} left`,
  twist: (p: { rifleName: string; twistInches: number; isRight: boolean }) =>
    `${p.rifleName}: 1 turn in ${p.twistInches}″, ${p.isRight ? 'right-hand' : 'left-hand'} — spin drift to the ${p.isRight ? 'right' : 'left'}`,
  coriolis: (p: { distance: string; timeOfFlightS: number; latitudeDeg: number; sinLatitude: number; coriolisMil: number }) =>
    `${p.distance}, t = ${decimal(p.timeOfFlightS, 2)} s, ${p.latitudeDeg}° N: 0.0729 × ${decimal(p.timeOfFlightS, 2)} × ${decimal(p.sinLatitude, 2)} = ${decimal(p.coriolisMil, 2)} MIL`,
  eotvos: (p: { distance: string; timeOfFlightS: number; latitudeDeg: number; cosLatitude: number; azimuthDeg: number; eotvosMil: number }) =>
    `${p.distance} to the east (az. ${p.azimuthDeg}°), ${p.latitudeDeg}° N: 0.0729 × ${decimal(p.timeOfFlightS, 2)} × ${decimal(p.cosLatitude, 2)} × 1 = ${decimal(p.eotvosMil, 2)} MIL`,
  secondShotCorrection: (p: { rightMil: number; downMil: number; windageClicks: number; elevationClicks: number }) =>
    `went ${decimal(p.rightMil)} MIL right and ${decimal(p.downMil)} low: WIND ${clickCount(p.windageClicks)} left, ELEV ${clickCount(p.elevationClicks)} up`,
};

export const textbook = {
  chapters: CHAPTERS,
  terms,
  imperialTerms,
  termExamples,
  model: {
    counter: (p: { opened: number; total: number }) => `${p.opened} / ${p.total} terms`,
    lockIntro: (p: { exerciseId: string }) => `opens in intro ${p.exerciseId}`,
    lockExercise: (p: { exerciseId: string }) => `opens in exercise ${p.exerciseId}`,
    whereLine: (p: { isFirst: boolean; exerciseId: string; title: string }) => `${p.isFirst ? 'first' : 'again'} — exercise ${p.exerciseId} · ${p.title}`,
  },
  page: {
    back: 'Back',
    title: 'Shooter’s textbook',
  },
  sheet: {
    example: 'example',
    where: 'where it appears',
    related: 'related',
    tryOnScope: 'Try it on the scope',
    close: 'Close',
  },
  termLinks: {
    checkErrors: {
      side: 'clock method',
      substitution: 'MANUAL',
      arithmetic: 'MANUAL',
      factor: 'MANUAL',
      reading: 'weather station',
      lead: 'lead',
      rounding: 'click',
      units: 'MOA',
      turret: 'turret',
    } satisfies Record<CheckErrorType, string>,
    causes: {
      distance: 'milling',
      dope: 'DOPE row',
      conditions: 'conditions correction',
      angle: 'shot angle',
      earth: 'spin drift',
      'wind-speed': 'wind',
      'wind-clock': 'clock method',
      zones: 'wind flag',
      'wind-calc': 'crosswind component',
      'lead-calc': 'lead',
      rounding: 'click',
      turret: 'turret',
      hold: 'breathing',
      lead: 'lead',
      trigger: 'trigger',
      zero: 'zero',
      'cold-bore': 'cold bore',
      formula: 'wind constant',
      rifle: 'group',
    } satisfies Record<CauseKind, string>,
    mainCauses: {
      calc: 'MANUAL',
      'wind-under': 'wind',
      'wind-over': 'wind',
      hold: 'breathing',
      lead: 'lead',
      trigger: 'trigger',
      zero: 'zero',
    } satisfies Record<MainCause, string>,
  },
  sandboxes: {
    clicks: { terms: ['click', 'turret'], hint: 'One click is 0.1 MIL. Turn the ELEV turret and watch the reticle move' },
    zeroStop: { terms: ['ZERO STOP'], hint: 'You are at zero. Turn the ELEV turret down — it won’t go below zero: that’s the ZERO STOP' },
    focalPlane: {
      terms: ['magnification', 'focal plane'],
      hint: 'Turn the magnification — the reticle marks grow with the gong: first focal plane, MIL is true at any magnification',
    },
    milling: { terms: ['reticle', 'milling'], hint: 'The distance is unknown. Measure the gong with the reticle in MIL, then notebook → DISTANCE: enter the reading' },
    wind: {
      terms: ['weather station', 'wind', 'clock method', 'clock value'],
      hint: 'Wind from the weather station: speed and clock. Tap — the wind clock shows the crosswind share',
    },
    flags: {
      terms: ['wind flag'],
      hint: (p: { flags: string }) => `Flags at ${p.flags}. The stronger the crosswind, the steeper the cloth`,
    },
    breathing: { terms: ['breathing', 'pulse'], hint: 'Hold — breath held, the reticle settles. Hold too long — it sways again' },
    trigger: { terms: ['trigger'], hint: 'Press the trigger smoothly until it fires. A sharp jerk throws the bullet off' },
    bolt: { terms: ['bolt'], hint: 'Fire — then cycle the bolt: up, back, forward, down' },
    dope: {
      terms: ['DOPE', 'DOPE row'],
      hint: (p: { distance: string; lower: number; upper: number }) => `DOPE card: there is no row for ${p.distance} — the correction is taken between ${p.lower} and ${p.upper}`,
    },
  },
  schemeTerms: {
    reticle: ['reticle', 'MIL', 'MOA', 'milling'],
    'focal-plane': ['focal plane', 'magnification'],
    trajectory: ['DOPE', 'DOPE row', 'zero', 'time of flight'],
    'wind-clock': ['clock method', 'clock value', 'crosswind component', 'wind'],
    cartridges: ['cartridge card', 'ballistic coefficient', 'energy', 'velocity spread', 'wind constant'],
    zones: ['wind zones', 'average wind', 'wind flag'],
    group: ['group', 'MPI', 'second-shot correction'],
  },
  schemes: {
    reticleCaptions: {
      'mil-dot': 'dot = 1 MIL',
      'mil-tick': 'tick = 1 MIL',
      'half-mil-tick': 'half tick = 0.5 MIL',
      'moa-tick': 'tick = 1 MOA = 0.29 MIL',
      'five-moa-tick': 'long tick = 5 MOA',
      'holdover-dot': 'tree dots: rows every 1 MIL down, 0.5 MIL steps sideways',
    } satisfies Record<Exclude<ReticleMarkKind, 'label'>, string>,
    firstPlaneCaption: (p: { magnification: number }) => `at ${p.magnification}× dot = 1 MIL — true at any magnification`,
    secondPlaneCaption: (p: { magnification: number; dotMil: number; trueMagnification: number }) =>
      `at ${p.magnification}× dot = ${roundedDecimal(p.dotMil, 1)} MIL — ${p.magnification === p.trueMagnification ? 'true' : `true only at ${p.trueMagnification}×`}`,
    windClockCaption: (p: { clockHours: number; share: number }) => `${p.clockHours} o’clock — value ${roundedDecimal(p.share, 2)}`,
    cartridgeFacts: (p: { mass: string; velocity: string; ballisticCoefficient: number; energy: string }) => [p.mass, p.velocity, `BC ${roundedDecimal(p.ballisticCoefficient, 3)}`, p.energy],
    energy: { metric: (p: { energy: number }) => `${p.energy} J`, imperial: (p: { energy: number }) => `${p.energy} ft-lb` },
    groupCaption: (p: { upMil: number; rightMil: number; upClicks: number; rightClicks: number }) => {
      const offset = `${arrow(p.upMil, '↑', '↓')} ${roundedDecimal(Math.abs(p.upMil), 1)} ${arrow(p.rightMil, '→', '←')} ${roundedDecimal(Math.abs(p.rightMil), 1)} MIL`;
      const transfer = `${arrow(p.upClicks, '↑', '↓')} ${Math.abs(p.upClicks)} ${arrow(p.rightClicks, '→', '←')} ${Math.abs(p.rightClicks)} cl.`;
      return `MPI ${offset} — move ${transfer}`;
    },
    term: {
      pendingCard: 'calculating the card…',
      pendingCartridges: 'calculating the cartridge cards…',
    },
    reticle: {
      names: { tree: 'Tree', 'mil-dot': 'MIL-dot', 'moa-grid': 'MOA' } satisfies Record<ReticleKind, string>,
      label: (p: { name: string }) => `${p.name} reticle`,
      tapHint: 'Tap a reticle mark',
    },
    focalPlane: {
      firstPlane: 'first plane',
      secondPlane: 'second plane',
      magnification: 'magnification',
    },
    cartridges: {
      dropTitle: 'drop, MIL',
      driftTitle: (p: { speed: string }) => `drift in ${p.speed}, MIL`,
      axis: (p: { distance: string; maxMil: number }) => `${p.distance} · ${roundedDecimal(p.maxMil, 1)} MIL`,
    },
    trajectory: {
      label: 'Cartridge B trajectory: correction by distance',
      sightLine: 'line of sight',
      zero: (p: { zero: string }) => `zero ${p.zero}`,
      timeMark: (p: { timeOfFlightS: number }) => `${decimal(p.timeOfFlightS)} s`,
      maxElevation: (p: { distance: string; maxMil: number }) => `at ${p.distance}: ↑ ${decimal(p.maxMil)} MIL`,
      caption: 'Cartridge B: how much to raise the scope to hit — the same curve as the DOPE rows. The dots are time of flight.',
    },
    windClock: {
      label: 'Wind clock: tap an hour',
      target: 'TARGET',
      hour: (p: { clockHours: number }) => `${p.clockHours} o’clock`,
      crosswindRule: '· crosswind = wind × value',
    },
    zones: {
      label: 'Wind zones along the range and their weights',
      shooter: 'you',
      caption: (p: { distance: string; lastStretch: string }) =>
        `Row ${p.distance}: average wind = Σ zone wind × weight. Wind at the shooter pushes the bullet early, and the drift builds all the way to the target: near zones weigh more, the last ${p.lastStretch} — almost nothing.`,
      lastStretch: { metric: 'meters', imperial: 'yards' },
    },
  },
};
