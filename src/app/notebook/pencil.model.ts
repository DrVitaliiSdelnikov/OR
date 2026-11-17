import { text } from '../../i18n';
import { Notebook } from '../../sim/notebook';
import { PencilMark, PencilPlace } from '../../sim/pencil-marks';
import { chainValuePair, ValueAxis } from '../review/review.model';

export interface PencilNote {
  player: string;
  needed: string;
}

export type PencilNotes = Partial<Record<PencilPlace, PencilNote>>;

const T = text.notebook.pencil;
const PLACE_AXES: Partial<Record<PencilPlace, ValueAxis>> = {
  dope: 'vertical',
  atmosphere: 'vertical',
  angle: 'vertical',
  eotvos: 'vertical',
  wind: 'horizontal',
  spin: 'horizontal',
  coriolis: 'horizontal',
};

export function pencilNotes(marks: readonly PencilMark[], notebook: Notebook): PencilNotes {
  const { system, clickMil } = notebook.context.card;
  const notes: Partial<Record<PencilPlace, { player: string[]; needed: string[] }>> = {};
  for (const mark of marks) {
    const pair = chainValuePair(mark.quantity, mark.player, mark.truth, PLACE_AXES[mark.place] ?? null, system, clickMil);
    if (!pair) {
      continue;
    }
    const note = (notes[mark.place] ??= { player: [], needed: [] });
    note.player.push(`${pair.player}${pair.unit}`);
    note.needed.push(`${pair.truth}${pair.unit}`);
  }
  return Object.fromEntries(Object.entries(notes).map(([place, note]) => [place, { player: note!.player.join(T.separator), needed: T.needed({ value: note!.needed.join(T.separator) }) }]));
}
