export const radio = {
  plate: {
    callsign: 'Старший',
    emptyChamber: 'дошли патрон затвором',
    forgottenFactor: (p: { factorName: string }) => `стой. Учти ${p.factorName.toUpperCase()}`,
    offMarks: 'барабаны не на метках',
  },
  overlay: {
    hintCount: (p: { number: number; count: number }) => `подсказка ${p.number} из ${p.count}`,
    understood: 'Понял',
    skip: 'пропустить обучение',
  },
};
