import { describe, expect, it } from 'vitest';
import { windAt } from '../core/scenario';
import { FREE_TASK, hasZoneWind, isAnswerCorrect, isTaskUnlocked, maxScore, scenarioForTask, ShootTask, taskById, TASKS } from './tasks';

const shootTask = (id: string): ShootTask => taskById(id) as ShootTask;

describe('course', () => {
  it('has the nine tasks of the pre-alpha in order', () => {
    expect(TASKS.map(task => task.id)).toEqual(['q-mrad', 'q-range', 's-zero', 's-500', 'q-clock', 's-wind300', 'q-moa', 's-moa500', 's-700']);
  });

  it('uses the design-system scope names', () => {
    expect(shootTask('s-zero').scopeId).toBe('dot');
    expect(shootTask('s-moa500').scopeId).toBe('moa');
  });

  it('finds the free mode by id', () => {
    expect(taskById('free')).toBe(FREE_TASK);
    expect(taskById('nope')).toBeUndefined();
  });

  it('max score is 10 per answer or per shot', () => {
    expect(maxScore(taskById('q-moa')!)).toBe(20);
    expect(maxScore(taskById('s-700')!)).toBe(50);
  });
});

describe('wind by level', () => {
  it('levels 1–2 have one wind over the whole range', () => {
    const task = shootTask('s-wind300');
    expect(hasZoneWind(task)).toBe(false);
    const zones = windAt(scenarioForTask(task), 30);
    expect(new Set(zones.map(zone => zone.speedMps)).size).toBe(1);
  });

  it('from level 3 zones differ', () => {
    const task = shootTask('s-700');
    expect(hasZoneWind(task)).toBe(true);
    const zones = windAt(scenarioForTask(task), 30);
    expect(new Set(zones.map(zone => zone.speedMps)).size).toBeGreaterThan(1);
  });

  it('calm tasks have no wind', () => {
    expect(windAt(scenarioForTask(shootTask('s-zero')), 10).every(zone => zone.speedMps === 0)).toBe(true);
  });
});

describe('quiz', () => {
  it('accepts answers inside the tolerance', () => {
    const question = (taskById('q-mrad') as Extract<ReturnType<typeof taskById>, { kind: 'quiz' }>).questions[0];
    expect(isAnswerCorrect(question, 1.04)).toBe(true);
    expect(isAnswerCorrect(question, 1.06)).toBe(false);
  });
});

describe('unlocking', () => {
  it('opens the first task and each next one after the previous is passed', () => {
    const passed = new Set<string>(['q-mrad']);
    expect(isTaskUnlocked(TASKS[0], passed, false)).toBe(true);
    expect(isTaskUnlocked(TASKS[1], passed, false)).toBe(true);
    expect(isTaskUnlocked(TASKS[2], passed, false)).toBe(false);
  });

  it('“open all” unlocks everything', () => {
    expect(isTaskUnlocked(TASKS[8], new Set(), true)).toBe(true);
  });
});
