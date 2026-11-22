import { decimal, plural, PluralForms } from '../format';
import type { DialDirection } from '../ru/instructor';

const DIAL_DIRECTIONS: Record<DialDirection, string> = { up: 'up', down: 'down', right: 'right', left: 'left' };

const ERROR_FORMS: PluralForms = ['error', 'errors', 'errors'];
const DAY_FORMS: PluralForms = ['day', 'days', 'days'];

export const instructor = {
  coach: {
    title: (p: { skill: string }) => `Coach: ${p.skill}`,
    drill: (p: { title: string; level: string }) => `${p.title} · ${p.level}`,
    levels: { learn: 'learning', timed: 'timed' },
    errors: (p: { count: number }) => `${p.count} ${plural(p.count, ERROR_FORMS)} this week`,
    errorsWithType: (p: { count: number; type: string }) => `${p.count} ${plural(p.count, ERROR_FORMS)} this week, mostly ${p.type}`,
    never: 'not trained yet',
    stale: (p: { days: number }) => `not trained for ${p.days} ${plural(p.days, DAY_FORMS)}`,
    weak: (p: { rating: number }) => `rating ${p.rating} of 100`,
  },
  dial: (p: { direction: DialDirection; clicks: number }) => `Dial ${DIAL_DIRECTIONS[p.direction]}: ${p.clicks} more cl.`,
  enter: 'Enter the total on the turrets',
  firstClicks: {
    scope: (p: { distance: string }) => `This is the scope. The target is a gong at ${p.distance}`,
    notebook: 'Open the notebook: the correction is there',
    dope: (p: { dopeMil: number }) => `DOPE is the bullet drop: ↑ ${decimal(p.dopeMil, 1)} MIL`,
    sideDrum: (p: { windageClicks: number }) => `The side turret is for wind. It is calm today, ${p.windageClicks}`,
    aim: 'Put the crosshair on the gong: drag the picture',
    fire: 'Fire',
    review: 'A breakdown comes after every shot. Read it and press NEXT',
  },
  zeroing: {
    zero: (p: { distance: string }) => `The scope is off. Let’s zero at ${p.distance}`,
    aim: 'Put the crosshair on the center of the target',
    cold: 'The first shot is a cold bore. Fire',
    group: 'Three more into one point: a group',
    correction: 'The correction is in clicks: dial it on the turrets',
    reaim: 'The turret moved the picture: aim at the center again',
  },
  breathAndTrigger: {
    breath: (p: { calmS: number }) => `Hold your breath and the mark shakes less. Window ${p.calmS} s`,
    notebook: (p: { exerciseId: string }) => `The correction works as in ${p.exerciseId}: open the notebook`,
    aim: 'Put the crosshair on the gong: drag the picture',
    press: 'Keep HOLD down, squeeze FIRE smoothly',
    bolt: 'Bolt: up, back, forward, down',
    pulse: 'Your pulse throws the aim off. Breathe between shots',
  },
  windAndStation: {
    wind: 'Wind. Measure it with the weather station first',
    stationTab: 'The weather station is in the “Conditions” tab',
    measure: (p: { seconds: number }) => `Hold “Measure” for ${p.seconds} s`,
    windTab: 'You have the speed. Now open “Wind”',
    clock: (p: { speed: string }) => `The arrow shows where the wind blows from, by the wind flag at the berm. Speed is ${p.speed}, from the weather station`,
  },
  zoneFlags: {
    flags: (p: { distances: string }) => `The wind changes along the range. Wind flags at ${p.distances} are left of the target: move the scope to them`,
    flagTap: 'Tap a wind flag: its angle and speed go into the notebook',
    weights: 'A zone’s weight is its share of the average wind. Weights come from the DOPE row at your distance',
    zonesStep: 'Average wind is a sum: weight × V⊥ of each zone. Weather station from the “Wind” tab, wind flags from the glass',
  },
  slope: {
    slope: 'The target is higher or lower: the shot angle is here. At an angle the bullet drops less than the DOPE says',
    angleStep: 'Work out the “Shot angle” step in the notebook',
    angleFormula: '(E + Z) × cos − Z: E is the DOPE row, Z is the zero angle from the card header, cos is next to the instrument chip',
  },
  longRange: {
    earth: (p: { distance: string }) => `Latitude and azimuth are here. Beyond ${p.distance}, spin drift and the Earth’s rotation enter the calculation`,
    steps: 'Work out “Spin drift” and “Coriolis” in the notebook',
    spinFormula: 'Spin drift is the SPIN column of the DOPE row. Correct against the bullet’s drift',
    coriolisFormula: 'Coriolis: 0.0729 × t × sin φ. In the northern hemisphere the bullet drifts right, so correct left',
  },
  patrol: {
    patrol: 'Target speed and direction are here. The arrow changes when it turns around',
    leadStep: 'Work out the lead: the “Lead” step in the notebook',
    holdLead: 'Hold the lead with the reticle ahead of the target, leave the turret alone. Keep tracking the target with the reticle and fire',
    ambush: 'Ambush: set the reticle ahead by the lead and wait for the target to arrive',
  },
  milling: {
    notebook: 'Open the notebook: the distance is unknown',
    distanceTab: 'Measure the gong with the reticle: the “Distance” tab',
    milling: (p: { size: string }) => `Gong ${p.size}. Touch the top and bottom edges, then “Calculate”`,
  },
  manualEasy: {
    notebook: 'Now you do the math yourself. Open the notebook',
    windFirst: (p: { exerciseId: string }) => `Wind first, as in ${p.exerciseId}: weather station and clock method`,
    sam: 'The wind is recorded. Now work it out yourself',
    chips: 'Tap a formula slot and drop a chip in: V⊥, then D',
    tape: 'Key in V⊥ × D ÷ K by the formula and record the step',
  },
  coldMorning: {
    notebook: 'Cold and high pressure — the bullet lands below the card. Open the notebook',
    conditionsTab: 'The weather is in the “Conditions” tab',
    columns: 'The “colder” and “pressure” columns are in the DOPE row for your distance, “DOPE” tab',
    step: 'Work out the “Atmosphere” step: ΔELEV from the two columns',
  },
  cartridgeChange: {
    magazine: (p: { cartridgeLetter: string }) => `The magazine is empty. Next is cartridge ${p.cartridgeLetter}`,
    card: (p: { cartridgeLetter: string }) => `Cartridge ${p.cartridgeLetter} has its own card with its own DOPE: recalculate`,
  },
  manualHard: {
    traps: 'Hard: some chips are traps, the wind constant goes in a slot',
    call: 'Where was the reticle at the shot? Make the call yourself',
    dopeNote: 'Write the second-shot correction into the DOPE in pencil',
  },
  forgottenFactor: (p: { factorName: string; contribution: string }) => `Account for ${p.factorName.toUpperCase()}: ${p.contribution}`,
};
