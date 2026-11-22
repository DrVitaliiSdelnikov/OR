export const about = {
  link: 'About',
  back: 'Back',
  title: 'Pocket shooting trainer',
  subtitle: 'Ballistics, hand calculation and a breakdown of every miss',
  points: [
    {
      title: 'Real ballistics',
      text: 'Point-mass model, G1 and G7, BC in ICAO or ASM atmosphere; shot angle, spin drift, Coriolis, altitude and weather, wind by range zones. The core is checked against an independent ballistic reference: tolerances, differences and the table are on the Model screen.',
    },
    {
      title: 'Your whole rifle',
      text: 'Rifle, cartridge and scope — from twist rate to click value, MIL or MOA, FFP or SFP; stability check; DOPE card for your rifle with printing.',
    },
    {
      title: 'Live conditions',
      text: 'Wind changes over time and along the path, flags, moving targets, cold bore, pressure trigger. Every shot is computed from scratch.',
    },
    {
      title: 'By hand or by input',
      text: 'MANUAL — a shooter’s notebook, as in the field: milling, DOPE, conditions, wind, lead, clicks. AUTO — enter observations, the math is done for you. Every line of the calculation is checked.',
    },
    {
      title: 'Every miss explained',
      text: 'A chain from range to turrets: which step moved the bullet, by how many MIL, what you had and what was needed. The fix — in red pencil on the right step.',
    },
    {
      title: 'Error log',
      text: 'Every error with its size; you can see which step lets you down most often.',
    },
    {
      title: 'Metric and yards',
      text: 'The whole program in meters or in yards, mph, °F and inHg.',
    },
    {
      title: 'Textbook and course',
      text: '14 exercises from the first clicks to the long-range line; terms open right from the breakdown.',
    },
    {
      title: 'Drills and daily task',
      text: 'Calculation cards and timed shooting on the line; a rating for each skill and coach advice on what to train; a daily task — the same for everyone, with a day streak.',
    },
    {
      title: 'Offline, no account',
      text: 'Everything is computed on the phone, your data stays with you.',
    },
  ],
  plansTitle: 'Planned',
  plans: ['Muzzle velocity by barrel length, powder temperature, aerodynamic jump', 'Full English translation'],
  licensesTitle: 'Licenses',
  licenses: [
    { name: 'js-ballistics', license: 'ISC' },
    { name: 'bclibc (engine inside js-ballistics)', license: 'LGPL-3.0' },
    { name: 'Angular', license: 'MIT' },
    { name: 'Ionic', license: 'MIT' },
    { name: 'Capacitor', license: 'MIT' },
  ],
  version: (p: { version: string }) => `version ${p.version}`,
};
