export const radio = {
  plate: {
    callsign: 'Range officer',
    emptyChamber: 'chamber a round with the bolt',
    forgottenFactor: (p: { factorName: string }) => `hold on. Account for ${p.factorName.toUpperCase()}`,
    offMarks: 'turrets are off the marks',
  },
  overlay: {
    hintCount: (p: { number: number; count: number }) => `hint ${p.number} of ${p.count}`,
    understood: 'Got it',
    skip: 'skip the tutorial',
  },
};
