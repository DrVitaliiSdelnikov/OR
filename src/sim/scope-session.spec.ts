import { describe, expect, it } from 'vitest';
import { BOLT_STEP_TRAVEL_PT, MAGAZINE_CAPACITY } from './bolt';
import { scopeById } from './scope-model';
import { BOLT_KNOCK_MIL, ScopeSession } from './scope-session';

const accessibility = { isZoneLarger: false, isMarkerDriftOff: true };
const impactUp = (session: ScopeSession, requiredUpMrad: number) => session.dial.upMrad - requiredUpMrad + session.aim.y;
const impactRight = (session: ScopeSession, requiredRightMrad: number) => session.dial.rightMrad - requiredRightMrad + session.aim.x;

function cycleBolt(session: ScopeSession): void {
  session.bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up, 0);
  session.bolt.drag(BOLT_STEP_TRAVEL_PT.back, 0, 0.2);
  session.bolt.drag(-BOLT_STEP_TRAVEL_PT.forward, 0, 0.4);
  session.bolt.drag(0, BOLT_STEP_TRAVEL_PT.down, 0.6);
}

describe('ScopeSession', () => {
  it('starts with a round chambered and four in the magazine', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    expect(session.bolt.canFire).toBe(true);
    expect(session.bolt.rounds).toBe(4);
  });

  it('loads the rounds it is given: one chambered, the rest in the magazine', () => {
    const session = new ScopeSession(scopeById('course-tree'), 62, 1, accessibility, 2);
    expect(session.bolt.canFire).toBe(true);
    expect(session.bolt.rounds).toBe(1);
  });

  it('dialing elevation does not move the impact until the shooter re-aims', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    const before = impactUp(session, 4.6);
    session.turnElevation(46);
    expect(impactUp(session, 4.6)).toBeCloseTo(before, 9);
    expect(session.aim.y).toBeCloseTo(-0.7 - 4.6, 9);
  });

  it('dialing wind left does not move the impact until the shooter re-aims', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    const before = impactRight(session, -0.8);
    session.turnWindageLeft(8);
    expect(impactRight(session, -0.8)).toBeCloseTo(before, 9);
    expect(session.dial.rightMrad).toBeCloseTo(-0.8, 9);
  });

  it('a click blocked by ZERO STOP does not move the aim', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    const aimY = session.aim.y;
    expect(session.turnElevation(-5).stop).toBe('zero');
    expect(session.aim.y).toBe(aimY);
  });

  it('dragging the picture right moves the cross left of the target', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    const aimX = session.aim.x;
    session.dragPicture(session.ptPerMil, 0);
    expect(session.aim.x).toBeCloseTo(aimX - 1, 9);
  });

  it('the target is drawn opposite to the cross offset', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    session.aim = { x: 1, y: 1 };
    const offset = session.targetOffsetPt;
    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });

  it('changing the scope resets the turrets and the zoom', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    session.turnElevation(30);
    session.setScope(scopeById('dot'));
    expect(session.elevation.clicks).toBe(0);
    expect(session.magnification).toBe(8);
  });

  it('fires through the trigger and leaves a spent case', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    session.aim = { x: 0, y: 0 };
    expect(session.startTrigger()).toBe(true);
    let hasFired = false;
    for (let step = 0; step < 600 && !hasFired; step++) {
      hasFired = session.step(1 / 60, { x: 0, y: 0 });
    }
    expect(hasFired).toBe(true);
    const outcome = session.fire();
    expect(outcome).not.toBeNull();
    expect(outcome!.hold.upMrad).toBeCloseTo(outcome!.reticle.upMrad + outcome!.triggerSpread.upMrad, 9);
    expect(outcome!.hold.rightMrad).toBeCloseTo(outcome!.reticle.rightMrad + outcome!.triggerSpread.rightMrad, 9);
    expect(session.bolt.chamberState).toBe('spent');
    expect(session.startTrigger()).toBe(false);
  });

  it('the hold at fire time is the cross offset plus the trigger spread', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    session.aim = { x: 0.3, y: -0.2 };
    const cross = session.crossOffsetMil;
    const outcome = session.fire()!;
    expect(outcome.hold.rightMrad).toBeCloseTo(cross.x, 9);
    expect(outcome.hold.upMrad).toBeCloseTo(cross.y, 9);
    expect(outcome.reticle).toEqual({ upMrad: cross.y, rightMrad: cross.x });
    expect(outcome.triggerSpread).toEqual({ upMrad: 0, rightMrad: 0 });
  });

  it('cannot fire again before the bolt is cycled', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    session.fire();
    expect(session.fire()).toBeNull();
    cycleBolt(session);
    expect(session.fire()).not.toBeNull();
  });

  it('knocks the aim by a fraction of a mil after cycling', () => {
    const session = new ScopeSession(scopeById('tree'), 62, 1, accessibility, MAGAZINE_CAPACITY);
    const before = { ...session.aim };
    session.knockAimAfterCycle();
    expect(Math.abs(session.aim.x - before.x)).toBeLessThanOrEqual(BOLT_KNOCK_MIL);
    expect(Math.abs(session.aim.y - before.y)).toBeLessThanOrEqual(BOLT_KNOCK_MIL);
    expect(session.aim).not.toEqual(before);
  });
});
