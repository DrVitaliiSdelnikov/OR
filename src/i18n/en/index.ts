import type { Messages } from '../messages';
import { content } from '../ru/content';
import { instructor } from '../ru/instructor';
import { intro } from '../ru/intro';
import { notebook } from '../ru/notebook';
import { position } from '../ru/position';
import { radio } from '../ru/radio';
import { briefing, result } from '../ru/result';
import { review } from '../ru/review';
import { textbook } from '../ru/textbook';
import { about } from './about';
import { daily } from './daily';
import { drills } from './drills';
import { model } from './model';
import { rifle } from './rifle';
import { screens } from './screens';
import { shell } from './shell';
import { skills } from './skills';
import { units } from './units';

export const PENDING_EN_MODULES: readonly (keyof Messages)[] = ['content', 'instructor', 'intro', 'notebook', 'position', 'radio', 'result', 'briefing', 'review', 'textbook'];

export const en: Messages = { about, content, daily, drills, skills, instructor, result, briefing, review, notebook, position, radio, shell, screens, textbook, intro, units, rifle, model };
