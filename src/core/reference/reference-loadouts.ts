import { DragModel, Loadout, TwistDirection } from '../types';
import reference223 from './223-77.json';
import reference308 from './308-175.json';
import reference338 from './338lm-300.json';
import reference65 from './65cm-140.json';

interface ReferenceInputs {
  cartridge: {
    name: string;
    massG: number;
    bulletDiameterIn: number;
    bulletLengthMm: number;
    dragModel: string;
    ballisticCoefficient: number;
    muzzleVelocityMps: number;
  };
  rifle: { sightHeightCm: number; zeroM: number; twistInchesPerTurn: number; twistDirection: string };
}

function loadoutOf(reference: ReferenceInputs): Loadout {
  return {
    rifle: {
      name: reference.cartridge.name,
      groupSigmaMrad: 0,
      coldBoreShiftMil: { upMrad: 0, rightMrad: 0 },
      ...reference.rifle,
      twistDirection: reference.rifle.twistDirection as TwistDirection,
    },
    cartridge: {
      id: 'B',
      blurb: '',
      muzzleVelocitySdMps: 0,
      ...reference.cartridge,
      dragModel: reference.cartridge.dragModel as DragModel,
    },
  };
}

export const REFERENCE_LOADOUTS: readonly { id: string; loadout: Loadout }[] = [
  { id: '308-175', loadout: loadoutOf(reference308) },
  { id: '65cm-140', loadout: loadoutOf(reference65) },
  { id: '223-77', loadout: loadoutOf(reference223) },
  { id: '338lm-300', loadout: loadoutOf(reference338) },
];
