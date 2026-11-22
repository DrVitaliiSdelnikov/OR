import type { Messages } from '../messages';
import { about } from './about';
import { content } from './content';
import { daily } from './daily';
import { drills } from './drills';
import { instructor } from './instructor';
import { intro } from './intro';
import { model } from './model';
import { notebook } from './notebook';
import { position } from './position';
import { radio } from './radio';
import { briefing, result } from './result';
import { review } from './review';
import { rifle } from './rifle';
import { screens } from './screens';
import { shell } from './shell';
import { skills } from './skills';
import { textbook } from './textbook';
import { units } from './units';

export const PENDING_EN_MODULES: readonly (keyof Messages)[] = [];

export const en: Messages = { about, content, daily, drills, skills, instructor, result, briefing, review, notebook, position, radio, shell, screens, textbook, intro, units, rifle, model };
