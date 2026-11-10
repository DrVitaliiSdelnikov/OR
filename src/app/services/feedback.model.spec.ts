import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_EVENTS, FEEDBACK_PLAN, FeedbackEvent, SELECTION_IDLE_MS, SelectionHaptics, soundOf } from './feedback.model';

const hapticOf = (event: FeedbackEvent) => FEEDBACK_PLAN[event].haptic;

describe('feedback plan = TOKENS «Звук и вибрация»', () => {
  it('drum clicks and dial detents are the iOS picker: selection', () => {
    expect((['drum-click', 'drum-whole-mil', 'detent'] as FeedbackEvent[]).map(hapticOf)).toEqual(['selection', 'selection', 'selection']);
    expect(hapticOf('drum-turn')).toBe('light');
  });

  it('stop, stamp and magazine are medium; the shot is heavy', () => {
    expect((['drum-stop', 'stamp', 'magazine', 'shot'] as FeedbackEvent[]).map(hapticOf)).toEqual(['medium', 'medium', 'medium', 'heavy']);
  });

  it('each of the four bolt steps is light; the casing only sounds', () => {
    expect((['bolt-unlock', 'bolt-slide', 'bolt-feed', 'bolt-lock'] as FeedbackEvent[]).map(hapticOf)).toEqual(['light', 'light', 'light', 'light']);
    expect(hapticOf('bolt-eject')).toBeNull();
  });

  it('buttons and the sheet only click; the radio and an empty chamber warn', () => {
    expect([hapticOf('button'), hapticOf('sheet')]).toEqual([null, null]);
    expect([hapticOf('radio'), hapticOf('empty-chamber')]).toEqual(['warning', 'warning']);
  });

  it('every event has a sound, and the plan covers every event', () => {
    expect(Object.keys(FEEDBACK_PLAN).sort()).toEqual([...FEEDBACK_EVENTS].sort());
    expect(FEEDBACK_EVENTS.filter(event => !FEEDBACK_PLAN[event].sound)).toEqual([]);
  });

  it('a whole MIL and a full turn tick louder than a plain click', () => {
    expect(FEEDBACK_PLAN['drum-click'].sound).toBe('tick');
    expect([FEEDBACK_PLAN['drum-whole-mil'].sound, FEEDBACK_PLAN['drum-turn'].sound]).toEqual(['tick-strong', 'tick-strong']);
  });
});

describe('звук по настройкам (U2)', () => {
  const audible = { volume: 0.5, isDrumClicksOn: true };

  it('щелчки барабанов выкл — у щелчка, целого MIL, оборота и упора нет звука; остальное звучит', () => {
    const muted = { ...audible, isDrumClicksOn: false };
    expect((['drum-click', 'drum-whole-mil', 'drum-turn', 'drum-stop'] as FeedbackEvent[]).map(event => soundOf(event, muted))).toEqual([null, null, null, null]);
    expect(soundOf('detent', muted)).toBe('tick');
    expect(soundOf('shot', muted)).toBe('shot');
    expect(soundOf('drum-click', audible)).toBe('tick');
  });

  it('громкость 0 — тишина у всех событий', () => {
    expect(FEEDBACK_EVENTS.map(event => soundOf(event, { volume: 0, isDrumClicksOn: true })).every(sound => sound === null)).toBe(true);
  });
});

describe('SelectionHaptics — the picker session', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function adapter() {
    return { start: vi.fn(), changed: vi.fn(), end: vi.fn() };
  }

  it('the first tick opens the selection; the next ones only change it', () => {
    const haptics = adapter();
    const selection = new SelectionHaptics(haptics);
    selection.tick();
    vi.advanceTimersByTime(100);
    selection.tick();
    expect(haptics.start).toHaveBeenCalledTimes(1);
    expect(haptics.changed).toHaveBeenCalledTimes(2);
    expect(haptics.end).not.toHaveBeenCalled();
  });

  it('quiet for the idle time — the selection ends; the next tick opens it again', () => {
    const haptics = adapter();
    const selection = new SelectionHaptics(haptics);
    selection.tick();
    vi.advanceTimersByTime(SELECTION_IDLE_MS - 1);
    expect(haptics.end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(haptics.end).toHaveBeenCalledTimes(1);
    selection.tick();
    expect(haptics.start).toHaveBeenCalledTimes(2);
  });

  it('ticks keep the selection open: the idle time counts from the last tick', () => {
    const haptics = adapter();
    const selection = new SelectionHaptics(haptics);
    selection.tick();
    vi.advanceTimersByTime(SELECTION_IDLE_MS - 50);
    selection.tick();
    vi.advanceTimersByTime(SELECTION_IDLE_MS - 50);
    expect(haptics.end).not.toHaveBeenCalled();
  });
});
