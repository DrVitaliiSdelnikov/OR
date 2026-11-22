import { decimal, plural, PluralForms } from '../format';

const CLICK_FORMS: PluralForms = ['click', 'clicks', 'clicks'];

export const intro = {
  steps: {
    rifle: {
      title: 'Rifle',
      instruction: 'This is the rifle. Tap each part to learn what it is for',
      parts: {
        barrel: { name: 'Barrel', caption: 'Speeds the bullet up and gives it its direction. A cold barrel shoots slightly differently from a warm one' },
        bolt: { name: 'Bolt', caption: 'Locks the cartridge in the barrel. After the shot: up, back, forward, down. The case flies out, a new cartridge is chambered' },
        magazine: { name: 'Magazine', caption: 'Five cartridges. When it is empty, change the magazine' },
        trigger: { name: 'Trigger', caption: 'Press smoothly until the shot breaks. A jerk throws the bullet off' },
        scope: { name: 'Scope', caption: 'Brings the target closer and shows where the barrel points, with the correction from the turrets' },
      },
    },
    scope: {
      title: 'Scope',
      instruction: 'The scope in cross-section. Tap each part',
      parts: {
        objective: { name: 'Objective', caption: 'The big front lens: gathers light from the target' },
        eyepiece: { name: 'Eyepiece', caption: 'The lens at your eye: through it you see the target and the reticle' },
        elevation: { name: 'ELEV turret', caption: 'Raises and lowers the point of impact: one click is 0.1 MIL' },
        windage: { name: 'WIND turret', caption: 'Moves the point of impact left and right: the wind correction' },
        zoom: {
          name: 'Ring',
          caption: (p: { magnificationMin: number; magnificationMax: number }) => `Magnification ring: zoom from ${p.magnificationMin}× to ${p.magnificationMax}×`,
        },
      },
    },
    drum: {
      title: 'Turret',
      instruction: (p: { clicks: number }) => `Dial the ELEV turret up ${p.clicks} ${plural(p.clicks, CLICK_FORMS)} and watch where the point of impact goes`,
    },
    zoom: { title: 'Magnification', instruction: 'Turn the magnification up and down: the gong and the reticle marks grow together' },
    reticles: {
      title: 'Reticles',
      instruction: (p: { gongSize: string; distance: string }) => `Tap the reticle marks. Then answer: how many MIL does a ${p.gongSize} gong at ${p.distance} take up?`,
    },
    cartridges: { title: 'Cartridges', instruction: 'Three cartridges: the heavier and sleeker the bullet, the less it drops and the less the wind pushes it' },
    bolt: { title: 'Bolt', instruction: 'Cycle the bolt: pull the handle up, back, forward, down' },
  },
  measureHint: {
    metric: 'Not quite. D = size × 1000 / mil, so mil = size × 1000 / D',
    imperial: 'Not quite. D = size × 27.78 / MIL, so MIL = size × 27.78 / D',
  },
  page: {
    back: 'Back',
    title: (p: { exerciseId: string; exerciseTitle: string }) => `${p.exerciseId} · ${p.exerciseTitle}`,
    stepCounter: (p: { number: number; count: number; title: string }) => `step ${p.number} of ${p.count} · ${p.title}`,
    callsign: 'Range officer:',
    question: (p: { gongSize: string; distance: string }) => `Gong ${p.gongSize} at ${p.distance}: how many MIL?`,
    answer: (p: { mil: number }) => `${decimal(p.mil)} MIL`,
    pendingCartridges: 'computing cartridge cards…',
    boltDone: 'Cartridge chambered, bolt closed',
    zoomOut: 'Decrease magnification',
    zoomIn: 'Increase magnification',
    finish: (p: { exerciseId: string }) => `Ready for exercise ${p.exerciseId}`,
    next: 'Next',
    drumCounter: (p: { clicks: number }) => `${p.clicks} cl.`,
  },
  partScheme: {
    rifleLabel: 'Rifle, side view',
    scopeLabel: 'Scope in cross-section',
    tapHint: 'Tap a part',
  },
};
