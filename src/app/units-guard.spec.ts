import { describe, expect, it } from 'vitest';
import { fromInput } from '../core/units';
import { COURSE } from '../sim/course';
import { briefingCard } from './course/briefing.model';
import { exerciseSheet, trailNodes } from './course/course-trail.model';
import { InstructorSnapshot } from './instructor/instructor-snapshot';
import { teachingScript } from './instructor/teaching.model';
import { introSteps, measureHint, measureQuestion } from './intro/intro.model';
import { SANDBOXES, sandboxTeaching } from './textbook/sandbox.model';

const METRIC_UNIT_TEXT =
  /\d(?:,\d+)?\s?(?:м|м\/с|гПа|°C|см|кг|Дж|г)(?![а-яёa-z])|(?:^|[\s,(«])(?:м|м\/с|гПа|°C|см|сантиметры|Дж|кг)(?=$|[\s,.)»;:·])|− 1013|\(15 −|× 1000 \//;
const COURSE_RESULTS = { isIntroCompleted: true, bestClasses: {} };

function imperialSnapshot(exerciseId: InstructorSnapshot['exerciseId']): InstructorSnapshot {
  return {
    exerciseId,
    unitSystem: 'imperial',
    sheetTab: null,
    hasOpenedNotebook: false,
    isEntered: false,
    dopeMil: 1.6,
    elevation: null,
    windageTargetClicks: 3,
    shotsFired: 0,
    isReviewOpen: false,
    isResultOpen: false,
    isBoltCycleDue: false,
    lastCorrection: null,
    turnedSinceShot: { upClicks: 0, rightClicks: 0 },
    aimOffMil: 1.1,
    isStationMeasured: true,
    stationSpeedMps: 2,
    windSpeedMps: 2,
    reticleMil: 1.11,
    measuredDistanceM: fromInput('distance', 500, 'imperial'),
    targetSizeM: fromInput('targetSize', 20, 'imperial'),
    targetDistanceM: fromInput('distance', 450, 'imperial'),
    recordedSteps: [],
    stageIndex: 0,
    isMagazineChangeDue: false,
    cartridgeLetter: 'Б',
    nextCartridgeLetter: 'В',
    isCallMarked: false,
    isDopeNoted: false,
    openCalcStep: null,
    flagsRead: 0,
    isAmbushTarget: false,
  };
}

function metricLeft(texts: readonly string[]): string[] {
  return texts.filter(line => METRIC_UNIT_TEXT.test(line)).map(line => `${line.match(METRIC_UNIT_TEXT)![0]} ← ${line}`);
}

describe('имперский рендер текстов с единицами (T1.8c)', () => {
  it('тренер: каждая реплика каждого упражнения — без метрических единиц', () => {
    const lines = COURSE.flatMap(def => (teachingScript(def.id) ?? []).map(step => step.text(imperialSnapshot(def.id))));
    expect(lines.length).toBeGreaterThan(40);
    expect(metricLeft(lines)).toEqual([]);
  });

  it('вводное: шаги, вопрос и подсказка — без метрических единиц', () => {
    const lines = [...introSteps('imperial').flatMap(step => [step.instruction, ...(step.parts ?? []).map(part => part.caption)]), measureQuestion('imperial'), measureHint(2, 'imperial')!];
    expect(metricLeft(lines)).toEqual([]);
  });

  it('песочницы учебника — без метрических единиц', () => {
    expect(metricLeft(SANDBOXES.map(sandbox => sandboxTeaching(sandbox, false, 'imperial')!.text))).toEqual([]);
  });

  it('листы и брифинги упражнений, тропа курса — без метрических единиц', () => {
    const lines = COURSE.flatMap(def => {
      const sheet = exerciseSheet(def, 'imperial');
      const briefing = briefingCard(def, COURSE_RESULTS, 'imperial');
      return [sheet.title, sheet.targets, sheet.wind, sheet.atmosphere, briefing.title, briefing.scheme.distanceText, ...Object.values(briefing.facts)];
    });
    lines.push(...trailNodes(COURSE_RESULTS, true, 'imperial').map(node => node.title));
    expect(metricLeft(lines.filter((line): line is string => typeof line === 'string'))).toEqual([]);
  });
});
