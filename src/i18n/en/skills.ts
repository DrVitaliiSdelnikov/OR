import { plural, PluralForms } from '../format';

const ATTEMPT_FORMS: PluralForms = ['attempt', 'attempts', 'attempts'];

export const skills = {
  levels: {
    beginner: 'Beginner',
    amateur: 'Amateur',
    shooter: 'Shooter',
    strong: 'Strong shooter',
    expert: 'Expert',
  },
  progress: {
    title: 'Progress',
    back: '← BACK',
    level: (p: { name: string; value: number }) => `${p.name} · ${p.value}`,
    levelUnknown: 'Level not set yet',
    levelHint: 'Finish a drill or an exercise and your level will appear',
    skillsTitle: 'Skills',
    attempts: (p: { count: number }) => `${p.count} ${plural(p.count, ATTEMPT_FORMS)}`,
    noAttempts: 'no attempts',
    weeksTitle: 'Level by week',
    weekLabel: (p: { day: string; month: string }) => `${p.month}/${p.day}`,
    errorsTitle: 'Calculation errors, last 4 weeks',
    errorCount: (p: { count: number }) => `×${p.count}`,
    noErrors: 'no check errors',
    journal: 'Shooter’s log',
  },
};
