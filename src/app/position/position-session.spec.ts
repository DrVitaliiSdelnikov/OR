import { describe, expect, it } from 'vitest';
import { RIFLE } from '../../core/content';
import { dopeRowAt } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { gaugeWindAt, lateralWindMps, windAt } from '../../core/scenario';
import { exerciseById } from '../../sim/course';
import { CauseKind, groupPoint, MissBreakdown } from '../../sim/miss-breakdown';
import { flagReading } from '../scene/scene.model';
import { PositionSession } from './position-session';

const engine = new BallisticsEngine();
const ACCESSIBILITY = { isZoneLarger: false, isMarkerDriftOff: true };
const ON_TARGET = { x: 0, y: 0 };
const FAR_OFF = { x: 6, y: 0 };

async function start(id: '01' | '02' | '04' | '05' | '06' | '08' | '09' | '10', seed = 11): Promise<PositionSession> {
  return PositionSession.start({ def: exerciseById(id)!, seed, engine, accessibility: ACCESSIBILITY });
}

function dialToTarget(session: PositionSession): void {
  const entered = session.enterOnTurrets();
  session.turn('elevation', entered.elevation.targetClicks - session.scope.elevation.clicks);
  session.turn('windage', entered.windageLeft.targetClicks - session.scope.windage.clicks);
}

async function shoot(session: PositionSession, aim: { x: number; y: number }) {
  session.scope.aim = { ...aim };
  return session.fire(session.scenario.startTimeS);
}

describe('PositionSession — start', () => {
  it('01: three gongs at 300 m, the course tree scope, the turret target is the DOPE row, 5 of 6 rounds loaded', async () => {
    const session = await start('01');
    expect(session.setup.targets.map(target => target.distanceM)).toEqual([300, 300, 300]);
    expect(session.scope.scope.id).toBe('course-tree');
    expect(session.total.elevation.targetClicks).toBe(dopeRowAt(session.notebook.context.card, 300).clicks);
    expect(session.total.windageLeft.targetClicks).toBe(0);
    expect(session.firingLine.magazineLoaded).toBe(5);
    expect(session.scope.bolt.rounds).toBe(4);
    expect(session.scope.bolt.canFire).toBe(true);
    expect(session.hasFired).toBe(false);
  });
});

describe('PositionSession — firing with a tap', () => {
  it('a shot is recorded at target 0 with the call, the diagnosis and the hit; the bolt cycles by itself', async () => {
    const session = await start('01');
    dialToTarget(session);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.targetIndex).toBe(0);
    expect(shot.record.isHit).toBe(true);
    expect(shot.record.isColdBore).toBe(false);
    expect(shot.record.diagnosis).toBe('clean');
    expect(shot.boltEvents).toEqual(['unlock', 'eject', 'feed', 'chamber', 'lock']);
    expect(session.scope.bolt.canFire).toBe(true);
    expect(session.firingLine.magazineLeft).toBe(4);
    expect(session.hasFired).toBe(true);
  });

  it('the shot keeps the wind at the shooter at that moment — for the journal statistics', async () => {
    const session = await start('04');
    dialToTarget(session);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.windSpeedMps).toBe(windAt(session.scenario, session.scenario.startTimeS)[0].speedMps);
    expect(shot.record.windSpeedMps).toBeGreaterThan(0);
  });

  it('a reticle on the target with an undialled turret is a data miss, not an execution one', async () => {
    const session = await start('01');
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.isHit).toBe(false);
    expect(shot.record.diagnosis).toBe('data');
  });

  it('a reticle far off the target is an execution miss', async () => {
    const session = await start('01');
    dialToTarget(session);
    const shot = (await shoot(session, FAR_OFF))!;
    expect(shot.record.isHit).toBe(false);
    expect(shot.record.diagnosis).toBe('execution');
  });

  it('a hit moves to the next target; two misses do too; the second miss on the last target ends it', async () => {
    const session = await start('01');
    dialToTarget(session);
    expect((await shoot(session, ON_TARGET))!.events).toEqual(['target-closed', 'next-target']);
    expect(session.firingLine.targetIndex).toBe(1);
    await shoot(session, FAR_OFF);
    expect((await shoot(session, FAR_OFF))!.events).toEqual(['target-closed', 'next-target']);
    expect(session.firingLine.targetIndex).toBe(2);
    await shoot(session, FAR_OFF);
    const fifth = (await shoot(session, FAR_OFF))!;
    expect(fifth.events).toEqual(['target-closed', 'exercise-done']);
  });

  it('an empty magazine refuses to fire until changed; the new magazine holds the rounds left', async () => {
    const session = await start('01');
    for (let shot = 0; shot < 4; shot++) {
      await shoot(session, FAR_OFF);
    }
    const fifth = (await shoot(session, FAR_OFF))!;
    expect(fifth.events).toEqual(['magazine-empty']);
    expect(fifth.boltEvents).toContain('feed-empty');
    expect(await shoot(session, FAR_OFF)).toBeNull();
    expect(session.isMagazineChangeDue).toBe(true);
    session.changeMagazine();
    expect(session.firingLine.magazineLoaded).toBe(1);
    expect(session.scope.bolt.canFire).toBe(true);
    expect(session.isMagazineChangeDue).toBe(false);
  });
});

describe('PositionSession — dialling exactly the first time (01)', () => {
  it('dialling straight to the target counts', async () => {
    const session = await start('01');
    dialToTarget(session);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(true);
  });

  it('only the first shot at a target can count', async () => {
    const session = await start('01');
    dialToTarget(session);
    expect((await shoot(session, FAR_OFF))!.record.isDialExactFirstTry).toBe(true);
    expect((await shoot(session, FAR_OFF))!.record.isDialExactFirstTry).toBe(false);
  });

  it('overshooting and coming back does not count', async () => {
    const session = await start('01');
    session.enterOnTurrets();
    session.turn('elevation', session.total.elevation.targetClicks + 1);
    session.turn('elevation', -1);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(false);
  });

  it('dialling the notebook total without entering it does not count (Б3)', async () => {
    const session = await start('01');
    session.turn('elevation', session.total.elevation.targetClicks);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(false);
  });

  it('firing before the turret is on target does not count', async () => {
    const session = await start('01');
    session.enterOnTurrets();
    session.turn('elevation', session.total.elevation.targetClicks - 2);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(false);
  });

  it('the turret progress follows the target and its start', async () => {
    const session = await start('01');
    expect(session.progress('elevation')).toBeNull();
    const target = session.enterOnTurrets().elevation.targetClicks;
    session.turn('elevation', target - 3);
    expect(session.progress('elevation')).toEqual({ remainingClicks: 3, direction: 'up', isOnTarget: false, overshootClicks: 0 });
    session.turn('elevation', 5);
    expect(session.progress('elevation')?.overshootClicks).toBe(2);
  });
});

describe('PositionSession — exercise 02', () => {
  it('the knocked sight shifts the impact; five shots at one target; the first is cold', async () => {
    const session = await start('02', 23);
    const offset = session.setup.sightOffset;
    expect(Math.hypot(offset.upMrad, offset.rightMrad)).toBeGreaterThanOrEqual(0.5);
    const shots = [];
    for (let shot = 0; shot < 5; shot++) {
      shots.push((await shoot(session, ON_TARGET))!);
    }
    expect(shots.map(shot => shot.record.isColdBore)).toEqual([true, false, false, false, false]);
    expect(shots.every(shot => shot.record.targetIndex === 0)).toBe(true);
    expect(shots[4].events).toEqual(['target-closed', 'exercise-done']);
    const coldImpact = shots[0].result.impact;
    expect(shots[0].result.coldBore).toEqual(RIFLE.coldBoreShiftMil);
    expect(shots[0].result.sightOffset).toEqual(offset);
    expect(Math.hypot(coldImpact.upMrad, coldImpact.rightMrad)).toBeGreaterThan(0.3);
  });
});

describe('PositionSession — the end', () => {
  it('three first-shot hits with exact dialling give class 1; each target adds 10 for an exact check', async () => {
    const session = await start('01');
    dialToTarget(session);
    for (let shot = 0; shot < 3; shot++) {
      await shoot(session, ON_TARGET);
    }
    expect(session.isFinished).toBe(true);
    expect(session.result()).toMatchObject({ exerciseClass: 1, isAdmitted: true, total: 60 });
  });

  it('all misses are not admitted', async () => {
    const session = await start('01');
    for (let shot = 0; shot < 5; shot++) {
      await shoot(session, FAR_OFF);
    }
    session.changeMagazine();
    await shoot(session, FAR_OFF);
    expect(session.isFinished).toBe(true);
    expect(session.result()).toMatchObject({ exerciseClass: 0, isAdmitted: false, total: 0 });
  });

  it('no result before the end, no shots after it', async () => {
    const session = await start('01');
    expect(session.result()).toBeNull();
    dialToTarget(session);
    for (let shot = 0; shot < 3; shot++) {
      await shoot(session, ON_TARGET);
    }
    expect(await shoot(session, ON_TARGET)).toBeNull();
  });
});

describe('PositionSession — trigger with pressure and the manual bolt (03)', () => {
  const CENTRE = { x: 0, y: 0 };
  const FRAME_S = 0.05;
  const MAX_FRAMES = 300;

  async function start03(seed = 31): Promise<PositionSession> {
    return PositionSession.start({ def: exerciseById('03')!, seed, engine, accessibility: { isZoneLarger: false, isMarkerDriftOff: true } });
  }

  function pressUntilShot(session: PositionSession): number {
    expect(session.startTrigger()).toBe(true);
    for (let frame = 1; frame <= MAX_FRAMES; frame++) {
      if (session.step(FRAME_S, CENTRE)) {
        return frame * FRAME_S;
      }
    }
    throw new Error('the trigger never broke');
  }

  function cycleBolt(session: PositionSession): void {
    session.dragBolt(0, -62, 0);
    session.dragBolt(-142, 0, 0.2);
    session.dragBolt(142, 0, 0.4);
    session.dragBolt(0, 62, 0.6);
  }

  async function pressureShot(session: PositionSession) {
    session.scope.aim = { ...ON_TARGET };
    pressUntilShot(session);
    return (await session.fire(session.scenario.startTimeS))!;
  }

  it('03 uses the pressure trigger; the trigger cannot start with an empty chamber', async () => {
    const session = await start03();
    expect(session.isBoltAutomatic).toBe(false);
    await pressureShot(session);
    expect(session.startTrigger()).toBe(false);
  });

  it('holding the finger in the zone breaks the shot in about 4.5 s; a held breath is recorded', async () => {
    const session = await start03();
    session.scope.sway.breath.press();
    session.scope.aim = { ...ON_TARGET };
    const seconds = pressUntilShot(session);
    expect(seconds).toBeGreaterThan(4);
    expect(seconds).toBeLessThan(6);
    const shot = (await session.fire(session.scenario.startTimeS))!;
    expect(shot.record.isBreathHeld).toBe(true);
  });

  it('lifting the finger lets the pressure drain; at zero the pull is cancelled', async () => {
    const session = await start03();
    session.startTrigger();
    for (let frame = 0; frame < 20; frame++) {
      session.step(FRAME_S, CENTRE);
    }
    expect(session.scope.trigger!.pressure).toBeGreaterThan(0);
    let frames = 0;
    while (session.scope.trigger && frames < MAX_FRAMES) {
      session.step(FRAME_S, null);
      frames++;
    }
    expect(session.scope.trigger).toBeNull();
  });

  it('after the shot the bolt waits; four strokes along the track chamber the next round and knock the aim', async () => {
    const session = await start03();
    await pressureShot(session);
    expect(session.scope.bolt.canFire).toBe(false);
    expect(session.isBoltCycleDue).toBe(true);
    const aimBefore = { ...session.scope.aim };
    cycleBolt(session);
    expect(session.scope.bolt.canFire).toBe(true);
    expect(session.isBoltCycleDue).toBe(false);
    expect(session.scope.aim).not.toEqual(aimBefore);
  });

  it('a stroke the wrong way along the track does nothing', async () => {
    const session = await start03();
    await pressureShot(session);
    session.dragBolt(0, -62, 0);
    session.dragBolt(142, 0, 0.2);
    expect(session.scope.bolt.currentStep).toBe('back');
  });

  it('a new magazine in 03 still needs the bolt to chamber the first round', async () => {
    const session = await start03();
    for (let shot = 0; shot < 5; shot++) {
      session.scope.aim = { ...FAR_OFF };
      pressUntilShot(session);
      await session.fire(session.scenario.startTimeS);
      if (shot < 4) {
        cycleBolt(session);
      }
    }
    expect(session.isMagazineChangeDue).toBe(true);
    expect(session.isBoltCycleDue).toBe(false);
    expect(session.changeMagazine()).toEqual(['magazine']);
    expect(session.scope.bolt.canFire).toBe(false);
    expect(session.isBoltCycleDue).toBe(true);
    cycleBolt(session);
    expect(session.scope.bolt.canFire).toBe(true);
  });
});

describe('PositionSession — entering the total on the turrets (Б3)', () => {
  it('no turret target before entering; entering freezes the total the notebook had', async () => {
    const session = await start('01');
    expect(session.enteredTotal).toBeNull();
    const entered = session.enterOnTurrets();
    expect(entered.elevation.targetClicks).toBe(dopeRowAt(session.notebook.context.card, 300).clicks);
    expect(session.enteredTotal).toEqual(entered);
  });

  it('a new target at the same distance keeps what was entered (01)', async () => {
    const session = await start('01');
    dialToTarget(session);
    await shoot(session, ON_TARGET);
    expect(session.firingLine.targetIndex).toBe(1);
    expect(session.enteredTotal).not.toBeNull();
  });

  it('a new target whose total differs in clicks clears what was entered (05)', async () => {
    const session = await start('05', 5);
    session.measureRange(rangeMil(session));
    session.enterOnTurrets();
    await shoot(session, FAR_OFF);
    session.scope.bolt.cycle();
    await shoot(session, FAR_OFF);
    expect(session.firingLine.targetIndex).toBe(1);
    expect(session.setup.targets[1].distanceM).not.toBe(session.setup.targets[0].distanceM);
    expect(session.enteredTotal).toBeNull();
  });

  it('a new cartridge at the same unknown-distance target keeps the milling; a new target forgets it', async () => {
    const base = exerciseById('05')!;
    const def = {
      ...base,
      targets: { ...base.targets!, count: 1 },
      stages: [
        { cartridgeId: 'B' as const, maxShotsPerTarget: 2, closesOnHit: true },
        { cartridgeId: 'C' as const, maxShotsPerTarget: 2, closesOnHit: true },
      ],
    };
    const session = await PositionSession.start({ def, seed: 5, engine, accessibility: ACCESSIBILITY });
    session.measureRange(rangeMil(session));
    await shoot(session, FAR_OFF);
    session.scope.bolt.cycle();
    await shoot(session, FAR_OFF);
    expect(session.firingLine.stageIndex).toBe(1);
    expect(session.notebook.readings.reticleMil).not.toBeNull();
    expect(session.notebook.context.card.cartridgeId).toBe('C');
  });

  it('re-entering the wind after entering changes the live total but not the entered one', async () => {
    const session = await start('04');
    session.measureStation(3, session.scenario.startTimeS);
    session.enterWind(session.notebook.readings.station!.windSpeedMps, session.notebook.readings.station!.windClock);
    const entered = session.enterOnTurrets();
    session.enterWind(0, 12);
    expect(session.enteredTotal).toEqual(entered);
    expect(session.total.windageLeft.targetClicks).not.toBe(entered.windageLeft.targetClicks);
  });
});

describe('PositionSession — station and readings', () => {
  it('a full 3 s measurement is close to the gauge; a short one is marked and noisier; wind is not carried over (Б11)', async () => {
    const session = await start('04');
    const timeS = session.scenario.startTimeS;
    const gauge = gaugeWindAt(session.scenario, timeS);
    const fullSpreads: number[] = [];
    for (let reading = 0; reading < 30; reading++) {
      session.measureStation(3, timeS);
      fullSpreads.push(Math.abs(session.notebook.readings.station!.windSpeedMps - gauge.speedMps));
    }
    const full = session.notebook.readings.station!;
    expect(full.isShort).toBe(false);
    expect(Math.max(...fullSpreads)).toBeLessThanOrEqual(0.15 + 1e-9);
    expect(full.windSpeedMps * 10).toBeCloseTo(Math.round(full.windSpeedMps * 10), 9);
    expect(full.temperatureC).toBe(session.scenario.gauge.temperatureC);
    expect(session.notebook.readings.wind).toBeNull();
    const shortSpreads: number[] = [];
    for (let reading = 0; reading < 30; reading++) {
      session.measureStation(1, timeS);
      shortSpreads.push(Math.abs(session.notebook.readings.station!.windSpeedMps - gauge.speedMps));
    }
    expect(session.notebook.readings.station!.isShort).toBe(true);
    expect(Math.max(...shortSpreads)).toBeLessThanOrEqual(0.35 + 1e-9);
    expect(Math.max(...shortSpreads)).toBeGreaterThan(0.15);
  });

  it('the same seed gives the same readings', async () => {
    const first = await start('04', 9);
    const second = await start('04', 9);
    const readings = (session: PositionSession): number[] =>
      Array.from({ length: 10 }, () => {
        session.measureStation(1, session.scenario.startTimeS);
        return session.notebook.readings.station!.windSpeedMps;
      });
    expect(readings(first)).toEqual(readings(second));
  });

  it('05: the notebook does not know the distance until milled; milling sets the player distance (Ж)', async () => {
    const session = await start('05', 5);
    expect(session.notebook.distanceM).toBeNull();
    expect(session.notebook.context.target.distanceM).toBeNull();
    expect(session.total.isEmpty).toBe(true);
    session.measureRange(1.7);
    expect(session.notebook.distanceM).toBeCloseTo((session.target.diameterM * 1000) / 1.7, 6);
    expect(session.total.isEmpty).toBe(false);
  });

  it('toggling a factor changes the total', async () => {
    const session = await start('04');
    session.enterWind(2.5, 9);
    const withWind = session.total.windageLeft.targetClicks;
    session.toggleFactor('wind');
    expect(withWind).not.toBe(0);
    expect(session.total.windageLeft.targetClicks).toBe(0);
  });
});

describe('PositionSession — the check is recorded with the shot', () => {
  it('04: wind typed off the station reading is a reading-speed error; typed as read is exact', async () => {
    const wrong = await start('04');
    wrong.measureStation(3, wrong.scenario.startTimeS);
    const station = wrong.notebook.readings.station!;
    wrong.enterWind(station.windSpeedMps + 2, station.windClock);
    dialToTarget(wrong);
    const wrongShot = (await shoot(wrong, ON_TARGET))!;
    expect(wrongShot.record.check?.rowVerdicts['reading-speed']).toBe('error');

    const right = await start('04');
    right.measureStation(3, right.scenario.startTimeS);
    right.enterWind(right.notebook.readings.station!.windSpeedMps, right.notebook.readings.station!.windClock);
    dialToTarget(right);
    const rightShot = (await shoot(right, ON_TARGET))!;
    expect(rightShot.record.check?.rowVerdicts['reading-speed']).toBe('exact');
    expect(rightShot.record.check?.rowVerdicts['turret-elevation']).toBe('exact');
  });

  it('the turret row compares the dial with the notebook total', async () => {
    const session = await start('04');
    session.enterWind(2.5, 9);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.check?.rowVerdicts['turret-elevation']).toBe('error');
  });

  it('05: the milled distance is the range estimate; a known distance has none', async () => {
    const milled = await start('05', 5);
    milled.measureRange(rangeMil(milled));
    milled.enterOnTurrets();
    const milledShot = (await shoot(milled, ON_TARGET))!;
    expect(Math.abs(milledShot.record.rangeEstimateM! - milled.setup.targets[0].distanceM)).toBeLessThan(0.05 * milled.setup.targets[0].distanceM);

    const known = await start('04');
    expect((await shoot(known, ON_TARGET))!.record.rangeEstimateM).toBeUndefined();
  });
});

function rangeMil(session: PositionSession): number {
  return Math.round((session.target.diameterM * 1000) / session.target.distanceM / 0.05) * 0.05;
}

describe('PositionSession — manual calculation (A5.2)', () => {
  function solveWind(session: PositionSession, divisor: number): void {
    session.enterWind(3.2, 9);
    session.placeChip('wind', 'crosswind');
    session.placeChip('wind', 'distance');
    const distanceM = session.notebook.distanceM!;
    const crosswind = stepChipValue(session, 'crosswind');
    session.typeTape('wind', 0, crosswind * distanceM);
    session.typeTape('wind', 1, (crosswind * distanceM) / divisor);
    session.typeTape('wind', 2, Math.round(((crosswind * distanceM) / divisor) * 10) / 10);
    session.setSign('wind', -1);
    session.recordStep('wind');
  }

  function solveDope(session: PositionSession): void {
    session.placeChip('dope', 'distance');
    session.typeTape('dope', 0, dopeRowAt(session.notebook.context.card, session.notebook.distanceM!).elevationMil);
    session.setSign('dope', 1);
    session.recordStep('dope');
  }

  function windConstant(session: PositionSession): number {
    return dopeRowAt(session.notebook.context.card, session.notebook.distanceM!).windConstant;
  }

  it('06: a recorded wind step goes into the total; an exact step is checked as exact with the shot', async () => {
    const session = await start('06');
    solveDope(session);
    solveWind(session, windConstant(session));
    const expectedClicks = Math.round(((stepChipValue(session, 'crosswind') * session.notebook.distanceM!) / windConstant(session)) * 10);
    expect(session.total.windageLeft.targetClicks).toBe(expectedClicks);
    dialToTarget(session);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.check?.rowVerdicts.wind).toBe('exact');
    expect(shot.record.check?.rowVerdicts.dope).toBe('exact');
  });

  it('06: a wrong divisor is a wind error; the easy hint names the type, not the number', async () => {
    const session = await start('06');
    solveDope(session);
    solveWind(session, windConstant(session) / 2);
    expect(session.softHint('wind')).toBe('arithmetic');
    dialToTarget(session);
    expect((await shoot(session, ON_TARGET))!.record.check?.rowVerdicts.wind).toBe('error');
  });

  it('a step cannot be recorded with an empty slot', async () => {
    const session = await start('06');
    session.typeTape('dope', 0, 2.8);
    session.setSign('dope', 1);
    expect(() => session.recordStep('dope')).toThrow(RangeError);
  });

  it('10: opening the reference costs 30 points in the result', async () => {
    const plain = await start('10');
    const peeked = await start('10');
    peeked.openReference();
    for (const session of [plain, peeked]) {
      solveDope(session);
      dialToTarget(session);
      for (let shot = 0; shot < 6 && !session.isFinished; shot++) {
        await shoot(session, ON_TARGET);
        session.scope.bolt.cycle();
        if (session.isMagazineChangeDue) {
          session.changeMagazine();
          session.scope.bolt.cycle();
        }
      }
    }
    expect(plain.result()!.total - peeked.result()!.total).toBe(30);
  });

  it('08: after the first cartridge the DOPE and wind steps are stale and the entered total is gone', async () => {
    const session = await start('08');
    solveDope(session);
    solveWind(session, windConstant(session));
    session.enterOnTurrets();
    await shoot(session, FAR_OFF);
    session.scope.bolt.cycle();
    await shoot(session, FAR_OFF);
    expect(session.firingLine.stageIndex).toBe(1);
    expect(session.staleness().dope).toBe('cartridge');
    expect(session.staleness().wind).toBe('cartridge');
    expect(session.enteredTotal).toBeNull();
  });
});

function stepChipValue(session: PositionSession, kind: 'crosswind' | 'distance'): number {
  return session.stepSheet('wind').chips.find(chip => chip.kind === kind)!.value;
}

describe('PositionSession — shot review (A6.1)', () => {
  it('a shot carries the call, the warm impact, the diagnosis and the check snapshot of the first shot at the target', async () => {
    const session = await start('01');
    dialToTarget(session);
    const notebookAtShot = session.notebook;
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.review.call).toEqual(shot.result.hold);
    expect(shot.review.diagnosis).toBe('clean');
    expect(shot.review.isFirstShotAtTarget).toBe(true);
    expect(shot.review.check?.result.verdict).toBe('exact');
    expect(shot.review.check?.notebook).toBe(notebookAtShot);
    expect(shot.review.targetRadiusMil).toBeCloseTo(((0.5 / 2) * 1000) / 300, 6);
  });

  it('a miss with a shot left gives the correction; the second shot at the target has no check of its own', async () => {
    const session = await start('01');
    const first = (await shoot(session, ON_TARGET))!;
    expect(first.record.isHit).toBe(false);
    expect(first.review.correction).not.toBeNull();
    expect(first.review.correction!.upClicks).toBeGreaterThan(0);
    const second = (await shoot(session, ON_TARGET))!;
    expect(second.review.isFirstShotAtTarget).toBe(false);
    expect(second.review.check).toBeNull();
    expect(second.review.correction).toBeNull();
  });

  it('the cold bore shift is taken out of the impact for the correction and the DOPE note', async () => {
    const session = await start('02', 23);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(shot.record.isColdBore).toBe(true);
    expect(shot.review.warmImpact.upMrad).toBeCloseTo(shot.result.impact.upMrad - RIFLE.coldBoreShiftMil.upMrad, 9);
  });

  it('a clean call gives a DOPE note; an execution miss gives none', async () => {
    const clean = await start('01');
    dialToTarget(clean);
    expect((await shoot(clean, ON_TARGET))!.review.dopeNoteMil).not.toBeNull();
    const wild = await start('01');
    dialToTarget(wild);
    expect((await shoot(wild, FAR_OFF))!.review.dopeNoteMil).toBeNull();
  });

  it('10: the player call is accurate within 0.2 MIL and goes into the record', async () => {
    const session = await start('10');
    const shot = (await shoot(session, ON_TARGET))!;
    const call = shot.review.call;
    expect(session.recordCall({ upMrad: call.upMrad + 0.15, rightMrad: call.rightMrad })).toBe(true);
    expect(session.records[0].isCallAccurate).toBe(true);
    expect(session.recordCall({ upMrad: call.upMrad + 0.4, rightMrad: call.rightMrad })).toBe(false);
    expect(session.records[0].isCallAccurate).toBe(false);
  });

  it('the repeat result goes without the mode multiplier (06: ×1.5 → ×1)', async () => {
    const plain = await start('06');
    const repeat = await plain.restartForRecalc(engine);
    for (const session of [plain, repeat]) {
      session.placeChip('dope', 'distance');
      session.typeTape('dope', 0, dopeRowAt(session.notebook.context.card, session.notebook.distanceM!).elevationMil);
      session.setSign('dope', 1);
      session.recordStep('dope');
      session.enterOnTurrets();
      while (!session.isFinished) {
        if (session.isMagazineChangeDue) {
          session.changeMagazine();
        }
        if (!session.scope.bolt.canFire) {
          session.scope.bolt.cycle();
        }
        await shoot(session, FAR_OFF);
      }
    }
    expect(repeat.result()!.total).toBeGreaterThan(0);
    expect(plain.result()!.total).toBe(Math.round(repeat.result()!.total * 1.5));
  });

  it('«пересчитать»: the same seed and targets, the notebook kept, no shots, no multiplier', async () => {
    const session = await start('06');
    session.enterWind(3.2, 9);
    await shoot(session, FAR_OFF);
    const repeat = await session.restartForRecalc(engine);
    expect(repeat.scenario.seed).toBe(session.scenario.seed);
    expect(repeat.setup.targets).toEqual(session.setup.targets);
    expect(repeat.notebook.readings.wind).toEqual({ speedMps: 3.2, clock: 9 });
    expect(repeat.records).toHaveLength(0);
    expect(repeat.firingLine.targetIndex).toBe(0);
    expect(repeat.isRepeatAfterRecalc).toBe(true);
  });
});

function causeOf(shot: { review: { breakdown: MissBreakdown } }, kind: CauseKind) {
  return shot.review.breakdown.causes.find(cause => cause.kind === kind)!;
}

describe('PositionSession — why the bullet went there (A6.2)', () => {
  it('the causes add up to the impact over seeds and exercises', async () => {
    for (const id of ['01', '04', '05', '06'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const session = await start(id, seed);
        session.enterWind(2, 9);
        session.enterOnTurrets();
        session.turn('elevation', 3);
        const shot = (await shoot(session, { x: 0.2, y: -0.1 }))!;
        const sum = shot.review.breakdown.causes.reduce((total, cause) => ({ upMrad: total.upMrad + cause.vector.upMrad, rightMrad: total.rightMrad + cause.vector.rightMrad }), { upMrad: 0, rightMrad: 0 });
        expect(Math.abs(sum.upMrad - shot.result.impact.upMrad)).toBeLessThan(0.02);
        expect(Math.abs(sum.rightMrad - shot.result.impact.rightMrad)).toBeLessThan(0.02);
      }
    }
  });

  it('01: dialled as planned and held on the centre — no calculation, wind, hold or trigger error; the formula is within a click of the core', async () => {
    const session = await start('01');
    dialToTarget(session);
    const shot = (await shoot(session, ON_TARGET))!;
    for (const kind of ['calc', 'wind', 'hold', 'trigger'] as const) {
      expect(causeOf(shot, kind).clicks).toBe(0);
    }
    expect(causeOf(shot, 'formula').clicks).toBeLessThanOrEqual(1);
    expect(shot.review.breakdown.main).toBeNull();
  });

  it('04: no wind written down — the wind estimate takes the whole wind, not the calculation', async () => {
    const session = await start('04');
    dialToTarget(session);
    const shot = (await shoot(session, ON_TARGET))!;
    const wind = causeOf(shot, 'wind');
    const formula = causeOf(shot, 'formula');
    expect(Math.abs(shot.result.ideal.rightMrad)).toBeGreaterThan(0.2);
    expect(wind.vector.rightMrad + formula.vector.rightMrad).toBeCloseTo(-shot.result.ideal.rightMrad, 1);
    expect(causeOf(shot, 'calc').clicks).toBe(0);
    expect(shot.review.breakdown.windVerdict).toBe('under');
  });

  it('a turret 5 clicks above the plan is a 5-click calculation error', async () => {
    const session = await start('01');
    dialToTarget(session);
    session.turn('elevation', 5);
    const shot = (await shoot(session, ON_TARGET))!;
    expect(causeOf(shot, 'calc').clicks).toBe(5);
    expect(causeOf(shot, 'calc').vector.upMrad).toBeCloseTo(0.5, 6);
  });

  it('the reticle off the centre is the hold', async () => {
    const session = await start('01');
    dialToTarget(session);
    const shot = (await shoot(session, { x: 0.3, y: 0 }))!;
    expect(causeOf(shot, 'hold').clicks).toBe(3);
    expect(shot.review.breakdown.main).toBe('hold');
    expect(shot.record.mainCause).toBe('hold');
  });

  it('02: the cold bore is a grey cause; the knocked sight and turret beyond the plan are the zero', async () => {
    const session = await start('02', 23);
    session.turn('elevation', 3);
    const shot = (await shoot(session, ON_TARGET))!;
    const cold = causeOf(shot, 'cold-bore');
    expect(cold.vector).toEqual(RIFLE.coldBoreShiftMil);
    expect(cold.isPlayerError).toBe(false);
    const zero = causeOf(shot, 'zero');
    expect(zero.vector.upMrad).toBeCloseTo(session.setup.sightOffset.upMrad + 0.3, 6);
    expect(zero.vector.rightMrad).toBeCloseTo(session.setup.sightOffset.rightMrad, 6);
    expect(causeOf(shot, 'calc').clicks).toBe(0);
  });

  it('the flight paths end at the impact and at the centre', async () => {
    const session = await start('01');
    const shot = (await shoot(session, ON_TARGET))!;
    const bulletEnd = shot.review.flight.bullet.at(-1)!;
    expect(bulletEnd.distanceM).toBe(300);
    expect(bulletEnd.heightCm).toBeCloseTo(shot.result.impact.upMrad * 30, 6);
    expect(shot.review.flight.centre.at(-1)!.heightCm).toBeCloseTo(0, 6);
  });

  it('the group gathers this run’s shots without data errors and cold bore; «пересчитать» starts it again', async () => {
    const session = await start('02', 23);
    const shots = [];
    for (let shot = 0; shot < 3; shot++) {
      shots.push((await shoot(session, ON_TARGET))!);
    }
    expect(shots.map(shot => shot.review.group.length)).toEqual([1, 2, 3]);
    const first = shots[0];
    expect(first.review.group[0]).toEqual(groupPoint(first.review.breakdown));
    expect(first.review.group[0].upMrad).toBeCloseTo(first.review.warmImpact.upMrad - causeOf(first, 'calc').vector.upMrad - causeOf(first, 'wind').vector.upMrad - causeOf(first, 'formula').vector.upMrad, 2);
    const repeat = await session.restartForRecalc(engine);
    expect((await shoot(repeat, ON_TARGET))!.review.group).toHaveLength(1);
  });
});

describe('PositionSession — flags along the range (09, A9.3a)', () => {
  it('a tapped flag goes to the notebook as its cloth reading at that moment', async () => {
    const session = await start('09');
    const timeS = session.scenario.startTimeS + 4;
    const reading = session.readFlag(1, timeS);
    expect(reading).toEqual(flagReading(lateralWindMps(windAt(session.scenario, timeS)[2])));
    expect(session.notebook.readings.flagCrosswindsMps).toEqual([null, reading.crosswindMps, null]);
  });

  it('flags at or beyond the gong are behind the berm, per target', async () => {
    const session = await start('09');
    const behindBerm = (distanceM: number) => [200, 400, 600].flatMap((flagM, index) => (flagM >= distanceM ? [index] : []));
    expect(session.notebook.readings.flagsBehindBerm).toEqual(behindBerm(session.target.distanceM));
  });
});
