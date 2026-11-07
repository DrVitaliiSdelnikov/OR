import { describe, expect, it } from 'vitest';
import { BOLT_STEP_TRAVEL_PT, BoltAction, BoltEvent } from './bolt';

function fullCycle(bolt: BoltAction, startS = 0): BoltEvent[] {
  const events: BoltEvent[] = [];
  events.push(...bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up, startS).events);
  events.push(...bolt.drag(BOLT_STEP_TRAVEL_PT.back, 0, startS + 0.3).events);
  events.push(...bolt.drag(-BOLT_STEP_TRAVEL_PT.forward, 0, startS + 0.6).events);
  events.push(...bolt.drag(0, BOLT_STEP_TRAVEL_PT.down, startS + 0.9).events);
  return events;
}

describe('BoltAction', () => {
  it('a full cycle chambers a round from the magazine', () => {
    const bolt = new BoltAction();
    const events = fullCycle(bolt);
    expect(events).toEqual(['unlock', 'slide', 'feed', 'chamber', 'lock']);
    expect(bolt.rounds).toBe(4);
    expect(bolt.chamberState).toBe('live');
    expect(bolt.canFire).toBe(true);
  });

  it('cannot fire with an empty chamber or an open bolt', () => {
    const bolt = new BoltAction();
    expect(bolt.canFire).toBe(false);
    fullCycle(bolt);
    bolt.drag(0, -30, 2);
    bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up, 2.1);
    expect(bolt.locked).toBe(false);
    expect(bolt.canFire).toBe(false);
  });

  it('firing leaves a spent case that the next cycle ejects', () => {
    const bolt = new BoltAction();
    fullCycle(bolt);
    expect(bolt.fire()).toBe(true);
    expect(bolt.fire()).toBe(false);
    const events = fullCycle(bolt, 2);
    expect(events).toContain('eject');
    expect(bolt.casingsOnGround).toEqual({ spent: 1, live: 0 });
  });

  it('cycling without firing ejects a live round', () => {
    const bolt = new BoltAction();
    fullCycle(bolt);
    fullCycle(bolt, 2);
    expect(bolt.casingsOnGround).toEqual({ spent: 0, live: 1 });
    expect(bolt.rounds).toBe(3);
  });

  it('an empty magazine closes the bolt on an empty chamber', () => {
    const bolt = new BoltAction(0);
    const events = fullCycle(bolt);
    expect(events).toContain('feed-empty');
    expect(bolt.chamberState).toBe('empty');
    expect(bolt.canFire).toBe(false);
  });

  it('a new magazine refills five rounds', () => {
    const bolt = new BoltAction(0);
    expect(bolt.insertMagazine()).toEqual(['magazine']);
    expect(bolt.rounds).toBe(5);
  });

  it('a magazine can be loaded with fewer rounds when the exercise has fewer left', () => {
    const bolt = new BoltAction(0);
    bolt.insertMagazine(1);
    expect(bolt.rounds).toBe(1);
  });

  it('moving against the step rolls progress back', () => {
    const bolt = new BoltAction();
    bolt.drag(0, -40, 0);
    const forward = bolt.progress;
    bolt.drag(0, 20, 0.1);
    expect(bolt.progress).toBeLessThan(forward);
    expect(bolt.currentStep).toBe('up');
  });

  it('movement across the step is ignored', () => {
    const bolt = new BoltAction();
    bolt.drag(200, 0, 0);
    expect(bolt.progress).toBe(0);
    expect(bolt.currentStep).toBe('up');
  });

  it('a step counts at 98 % of its travel', () => {
    const bolt = new BoltAction();
    expect(bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up * 0.97, 0).stepCompleted).toBeNull();
    expect(bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up * 0.02, 0.1).stepCompleted).toBe('up');
  });

  it('the bolt stays where it was let go', () => {
    const bolt = new BoltAction();
    bolt.drag(0, -BOLT_STEP_TRAVEL_PT.up, 0);
    bolt.drag(70, 0, 0.2);
    expect(bolt.currentStep).toBe('back');
    expect(bolt.progress).toBeCloseTo(0.5);
  });

  it('measures the cycle time from lift to lock', () => {
    const bolt = new BoltAction();
    fullCycle(bolt, 10);
    expect(bolt.averageCycleTimeS).toBeCloseTo(0.9);
  });
});
