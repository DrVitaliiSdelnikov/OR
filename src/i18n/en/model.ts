import { UnitSystem } from '../../core/units';
import type { FormulaRanges, FormulaTexts } from '../ru/model';

const IMPERIAL_FORMULAS = {
  distance: 'D (yd) = size (in) × 27.78 / MIL',
  wind: 'W = V⊥ (mph) × D (yd) / K, K from the DOPE row',
  atmosphere: 'ΔELEV = (59 − T) / 10 × “colder” + (P − 29.92) / 0.3 × “pressure”',
  lead: 'L = 488.9 × V⊥ (mph) × t / D (yd)',
};

const METRIC_FORMULAS: typeof IMPERIAL_FORMULAS = {
  distance: 'D = size (m) × 1000 / MIL',
  wind: 'W = V⊥ (m/s) × D (m) / K, K from the DOPE row',
  atmosphere: 'ΔELEV = (15 − T) / 10 × “10 colder” + (P − 1013) / 10 × “pressure +10”',
  lead: 'L = V⊥ × t × 1000 / D',
};

export const model = {
  title: 'Model and validation',
  back: 'Back',
  link: 'Model and validation →',
  intro: 'How the bullet’s flight is computed, where the model simplifies and how it is checked.',
  loading: 'Computing…',
  effectsTitle: 'What the core accounts for',
  effects: [
    { title: 'Point-mass model', text: 'js-ballistics with the bclibc engine: the trajectory is integrated step by step, and every bullet flies along it.' },
    { title: 'Drag', text: 'G7 or G1 with the cartridge BC; BC referenced to ICAO or ASM atmosphere.' },
    { title: 'Atmosphere', text: 'Temperature, station pressure and humidity; altitude enters through pressure.' },
    { title: 'Wind', text: 'By range zones, changing over time.' },
    { title: 'Shot angle', text: 'Range along the line of sight, drop by horizontal distance.' },
    { title: 'Spin drift', text: 'From twist rate and direction and bullet length.' },
    { title: 'Coriolis', text: 'From latitude and shot azimuth: sideways and vertical.' },
  ],
  assumptionsTitle: 'Assumptions',
  assumptions: (p: { zeroTemperature: string; zeroPressure: string }) => [
    'Drag curves are the standard G7 and G1, not a measured curve of a specific bullet',
    'Wind is horizontal only: no updrafts or downdrafts',
    'Aerodynamic jump (vertical shift from crosswind) is not modeled',
    `Zero is on a level line in the ICAO standard atmosphere: ${p.zeroTemperature}, ${p.zeroPressure}`,
    'Muzzle velocity is constant: barrel length and powder temperature are not modeled',
    'Altitude affects the shot only through station pressure',
  ],
  formulasTitle: 'Game formulas next to the core',
  formulasIntro: 'You calculate with them in the notebook, and MANUAL steps are checked against them. The bullet flies by the core; the difference shows as a grey “formula simplification” chip in the breakdown.',
  playerLabel: 'Player',
  coreLabel: 'Core',
  accuracyLabel: 'Accuracy',
  formulas: (system: UnitSystem, p: FormulaRanges): FormulaTexts[] => {
    const formulas = system === 'imperial' ? IMPERIAL_FORMULAS : METRIC_FORMULAS;
    return [
      { title: 'Range', formula: formulas.distance, core: 'knows the true range; a milling error is the “range” step in the breakdown', accuracy: 'class tolerance: ±5% in class 1, ±10% in class 2' },
      { title: 'Wind', formula: formulas.wind, core: 'wind by zones along the path, over time', accuracy: `under one click at ${p.windRange} with V⊥ up to ${p.windSpeed}` },
      { title: 'Atmosphere', formula: formulas.atmosphere, core: 'air density from temperature, pressure and humidity', accuracy: `within a click up to ${p.atmosphereNear}, within 2 clicks at ${p.atmosphereFar}` },
      { title: 'Shot angle', formula: 'ELEV = (DOPE + Z) × cos α − Z, Z is the zero angle', core: 'trajectory at an angle', accuracy: `±30°: within a click up to ${p.angleNear}, within 2 clicks at ${p.angleFar}` },
      { title: 'Spin drift', formula: 'SPIN column of the DOPE row', core: 'from twist rate and bullet length', accuracy: 'weather and altitude change it by no more than 0.03 MIL' },
      { title: 'Coriolis', formula: 'sideways 1000 × Ω × t × sin φ; vertical × cos φ × sin azimuth', core: 'Earth’s rotation in the equations of flight', accuracy: 'within 0.03 MIL of the core' },
      { title: 'Lead', formula: formulas.lead, core: 'the target moves during this bullet’s flight time', accuracy: `under half a click at ${p.leadRange}` },
    ];
  },
  comparisonTitle: 'Validation against a reference',
  source: (p: { library: string; version: string; date: string }) =>
    `Reference — ${p.library} ${p.version}, ELR solver, computed ${p.date}. Core numbers are computed right now, on this device.`,
  tolerance: (p: { range: string; vertical: string; wind: string; time: string; timeOnIncline: string }) =>
    `Tolerance at ${p.range}: elevation ≤ ${p.vertical} MIL, windage ≤ ${p.wind} MIL, time ≤ ${p.time} (at an angle ≤ ${p.timeOnIncline})`,
  cartridges: {
    '308-175': '.308 175 gr',
    '65cm-140': '6.5 Creedmoor 140 gr',
    '223-77': '.223 77 gr',
    '338lm-300': '.338 LM 300 gr',
  } as Record<string, string>,
  sets: {
    'sea-level-calm': () => 'Sea level · calm',
    'altitude-1500-wind-3': (p: { altitude: string; wind: string }) => `${p.altitude} · wind ${p.wind} from 3 o’clock`,
    'uphill-15-coriolis-55n-east': (p: { angleDeg: number; latitudeDeg: number }) => `Uphill ${p.angleDeg}° · ${p.latitudeDeg}° N · facing east`,
  },
  distanceHeader: (p: { unit: string }) => `DIST, ${p.unit}`,
  ourUpHeader: 'ELEV core',
  referenceUpHeader: 'ELEV ref.',
  upDifferenceHeader: 'Δ ELEV',
  rightDifferenceHeader: 'Δ WIND',
  timeDifferenceHeader: 'Δ t',
  timeDifference: (p: { value: string }) => `${p.value}%`,
  summary: (p: { up: string; right: string; time: string; verdict: string }) => `Largest |Δ|: ELEV ${p.up} · WIND ${p.right} MIL · time ${p.time}% — ${p.verdict}`,
  within: 'within tolerance',
  outside: 'out of tolerance',
  alignment: 'To compare like with like, the reference uses a level zero and BC per ICAO, and aerodynamic jump is reported separately: the core does not model it.',
  inclineNote: 'At an angle the core slows the bullet less on the climb than lob ELR does: time of flight is shorter. Both are models; which is closer to a real bullet only a check against measurements can show.',
};
