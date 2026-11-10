import { MRAD_PER_MOA, ReticleKind } from './scope-model';

export type ReticleMarkKind = 'mil-tick' | 'half-mil-tick' | 'moa-tick' | 'five-moa-tick' | 'mil-dot' | 'holdover-dot' | 'label';

export interface ReticleMark {
  kind: ReticleMarkKind;
  rightMil: number;
  downMil: number;
  text?: string;
}

export interface Reticle {
  marks: readonly ReticleMark[];
  thickPostFromMil: number | null;
}

const SIDES = [-1, 1] as const;
const TREE_SCALE_MIL = 14;
const TREE_SCALE_UP_MIL = 6;
const TREE_LABEL_EVERY_MIL = 2;
const TREE_HOLDOVER_ROWS = 10;
const TREE_ROW_BASE_HALF_WIDTH_MIL = 1;
const TREE_ROW_WIDENING_MIL = 0.55;
const TREE_ROW_MAX_HALF_WIDTH_MIL = 8;
const TREE_HOLDOVER_STEP_MIL = 0.5;
const MOA_SCALE = 40;
const MOA_LONG_TICK_EVERY = 5;
const MOA_LABEL_EVERY = 10;
const MIL_DOTS = 4;
const MIL_DOT_POST_FROM_MIL = 4.2;
const FLOAT_TOLERANCE = 1e-9;

export function reticleMarks(kind: ReticleKind): Reticle {
  switch (kind) {
    case 'tree':
      return { marks: treeMarks(), thickPostFromMil: null };
    case 'moa-grid':
      return { marks: moaMarks(), thickPostFromMil: null };
    case 'mil-dot':
      return { marks: milDotMarks(), thickPostFromMil: MIL_DOT_POST_FROM_MIL };
  }
}

function treeMarks(): ReticleMark[] {
  const marks: ReticleMark[] = [];
  for (let mil = 1; mil <= TREE_SCALE_MIL; mil++) {
    for (const side of SIDES) {
      marks.push({ kind: 'mil-tick', rightMil: side * mil, downMil: 0 });
      marks.push({ kind: 'half-mil-tick', rightMil: side * (mil - 0.5), downMil: 0 });
      if (side > 0 || mil <= TREE_SCALE_UP_MIL) {
        marks.push({ kind: 'mil-tick', rightMil: 0, downMil: side * mil });
      }
    }
    if (mil % TREE_LABEL_EVERY_MIL === 0) {
      marks.push({ kind: 'label', rightMil: mil, downMil: 0, text: String(mil) });
    }
  }
  for (let row = 1; row <= TREE_HOLDOVER_ROWS; row++) {
    const halfWidthMil = Math.min(TREE_ROW_BASE_HALF_WIDTH_MIL + row * TREE_ROW_WIDENING_MIL, TREE_ROW_MAX_HALF_WIDTH_MIL);
    for (let column = -halfWidthMil; column <= halfWidthMil + FLOAT_TOLERANCE; column += TREE_HOLDOVER_STEP_MIL) {
      marks.push({ kind: 'holdover-dot', rightMil: column, downMil: row });
    }
  }
  return marks;
}

function moaMarks(): ReticleMark[] {
  const marks: ReticleMark[] = [];
  for (let moa = 1; moa <= MOA_SCALE; moa++) {
    const kind = moa % MOA_LONG_TICK_EVERY === 0 ? 'five-moa-tick' : 'moa-tick';
    for (const side of SIDES) {
      marks.push({ kind, rightMil: side * moa * MRAD_PER_MOA, downMil: 0 });
      marks.push({ kind, rightMil: 0, downMil: side * moa * MRAD_PER_MOA });
    }
    if (moa % MOA_LABEL_EVERY === 0) {
      marks.push({ kind: 'label', rightMil: moa * MRAD_PER_MOA, downMil: 0, text: String(moa) });
    }
  }
  return marks;
}

function milDotMarks(): ReticleMark[] {
  const marks: ReticleMark[] = [];
  for (let mil = 1; mil <= MIL_DOTS; mil++) {
    for (const side of SIDES) {
      marks.push({ kind: 'mil-dot', rightMil: side * mil, downMil: 0 });
      marks.push({ kind: 'mil-dot', rightMil: 0, downMil: side * mil });
    }
  }
  return marks;
}
