import { COURSE_RIFLE } from '../../core/content';
import { UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { canAddProfile, RifleProfile } from '../../sim/rifle-profile';
import { CARTRIDGE_LETTERS } from '../notebook/notebook.model';

export interface CourseRifleRow {
  name: string;
  line: string;
  isActive: boolean;
}

export interface OwnRifleRow extends CourseRifleRow {
  id: string;
}

export interface RifleListView {
  course: CourseRifleRow;
  own: OwnRifleRow[];
  canAdd: boolean;
}

export const IS_PRO_UNLOCKED = true;

const T = text.rifle;
const quantityText = text.units.quantityText;

export function rifleListView(profiles: readonly RifleProfile[], activeProfileId: string | null, system: UnitSystem, isProUnlocked: boolean): RifleListView {
  return {
    course: {
      name: COURSE_RIFLE.name,
      line: T.courseRifleLine({ cartridgeLetter: CARTRIDGE_LETTERS.B, zero: quantityText('distance', COURSE_RIFLE.zeroM, system) }),
      isActive: activeProfileId === null,
    },
    own: profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      line: T.ownLine({
        velocity: quantityText('muzzleVelocity', profile.cartridge.muzzleVelocityMps, system),
        dragModel: profile.cartridge.dragModel,
        ballisticCoefficient: profile.cartridge.ballisticCoefficient,
        zero: quantityText('distance', profile.rifle.zeroM, system),
      }),
      isActive: profile.id === activeProfileId,
    })),
    canAdd: canAddProfile(profiles, isProUnlocked),
  };
}
