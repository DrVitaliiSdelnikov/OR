import { roundToClicks } from '../core/game-formulas';
import { ChainLink, ChainLinkKind, ChainQuantity, ChainValue } from './miss-chain';
import { Notebook, NotebookStepId } from './notebook';

export type AutoInput = 'milling' | 'wind-speed' | 'wind-clock' | 'flags';
export type PencilPlace = NotebookStepId | AutoInput;

export interface PencilMark {
  place: PencilPlace;
  kind: ChainLinkKind;
  quantity: ChainQuantity;
  player: ChainValue;
  truth: ChainValue;
  seal: string;
}

const MANUAL_PLACES: Partial<Record<ChainLinkKind, NotebookStepId>> = {
  distance: 'distance',
  dope: 'dope',
  conditions: 'atmosphere',
  angle: 'angle',
  'wind-speed': 'wind',
  'wind-clock': 'wind',
  zones: 'zones',
  'wind-calc': 'wind',
  lead: 'lead',
};

const AUTO_PLACES: Partial<Record<ChainLinkKind, AutoInput>> = {
  distance: 'milling',
  'wind-speed': 'wind-speed',
  'wind-clock': 'wind-clock',
  zones: 'flags',
};

export function pencilMarksAfterShot(notebook: Notebook, chain: readonly ChainLink[]): PencilMark[] {
  const clickMil = notebook.context.card.clickMil;
  const marked = chain.filter(link => link.clicks > 0).flatMap((link): Omit<PencilMark, 'seal'>[] => {
    if (notebook.mode === 'auto') {
      const place = AUTO_PLACES[link.kind];
      const isMilled = link.kind !== 'distance' || notebook.readings.reticleMil !== null;
      return place && isMilled ? [{ place, kind: link.kind, quantity: link.quantity, player: link.player, truth: link.truth }] : [];
    }
    if (link.kind === 'earth') {
      return (link.parts ?? [])
        .filter(part => Math.abs(roundToClicks(part.player - part.truth, clickMil)) > 0)
        .map(part => ({ place: part.factor as NotebookStepId, kind: link.kind, quantity: 'mil', player: part.player, truth: part.truth }));
    }
    const place = MANUAL_PLACES[link.kind];
    return place ? [{ place, kind: link.kind, quantity: link.quantity, player: link.player, truth: link.truth }] : [];
  });
  return marked.map(mark => ({ ...mark, seal: sealOf(mark.place, notebook) }));
}

export function withoutStaleMarks(marks: readonly PencilMark[], notebook: Notebook): PencilMark[] {
  return marks.filter(mark => mark.seal === sealOf(mark.place, notebook));
}

// Метка держится, пока не тронуто место, где игрок её исправляет: шаг САМ целиком или свой ввод АВТО.
function sealOf(place: PencilPlace, notebook: Notebook): string {
  switch (place) {
    case 'milling':
      return JSON.stringify([notebook.readings.reticleMil, notebook.distanceM]);
    case 'wind-speed':
    case 'wind-clock':
      return JSON.stringify(notebook.readings.wind);
    case 'flags':
      return JSON.stringify(notebook.readings.flagCrosswindsMps);
    default:
      return JSON.stringify(notebook.steps[place]);
  }
}
