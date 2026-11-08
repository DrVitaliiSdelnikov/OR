import { describe, expect, it } from 'vitest';
import { RIFLE } from '../../core/content';
import { dopeRowAt } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { exerciseById } from '../../sim/course';
import { PositionSession } from './position-session';

const engine = new BallisticsEngine();
const ACCESSIBILITY = { isZoneLarger: false, isMarkerDriftOff: true };
const ON_TARGET = { x: 0, y: 0 };
const FAR_OFF = { x: 6, y: 0 };

async function start(id: '01' | '02', seed = 11): Promise<PositionSession> {
  return PositionSession.start({ def: exerciseById(id)!, seed, engine, accessibility: ACCESSIBILITY });
}

function dialToTarget(session: PositionSession): void {
  session.turn('elevation', session.total.elevation.targetClicks - session.scope.elevation.clicks);
  session.turn('windage', session.total.windageLeft.targetClicks - session.scope.windage.clicks);
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
    session.turn('elevation', session.total.elevation.targetClicks + 1);
    session.turn('elevation', -1);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(false);
  });

  it('firing before the turret is on target does not count', async () => {
    const session = await start('01');
    session.turn('elevation', session.total.elevation.targetClicks - 2);
    expect((await shoot(session, ON_TARGET))!.record.isDialExactFirstTry).toBe(false);
  });

  it('the turret progress follows the target and its start', async () => {
    const session = await start('01');
    const target = session.total.elevation.targetClicks;
    session.turn('elevation', target - 3);
    expect(session.progress('elevation')).toEqual({ remainingClicks: 3, direction: 'up', isOnTarget: false, overshootClicks: 0 });
    session.turn('elevation', 5);
    expect(session.progress('elevation').overshootClicks).toBe(2);
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
  it('three first-shot hits with exact dialling give class 1', async () => {
    const session = await start('01');
    dialToTarget(session);
    for (let shot = 0; shot < 3; shot++) {
      await shoot(session, ON_TARGET);
    }
    expect(session.isFinished).toBe(true);
    expect(session.result()).toMatchObject({ exerciseClass: 1, isAdmitted: true, total: 30 });
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
    expect(session.isTapTrigger).toBe(false);
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
