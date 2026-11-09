import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { targetRadiusMrad } from '../../core/content';
import { dopeRowAt } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { impactSoundDelayS } from '../../core/field';
import { lateralWindMps, windAt } from '../../core/scenario';
import { Correction } from '../../core/types';
import { BoltEvent } from '../../sim/bolt';
import { courseProgress, ExerciseDef, exerciseById, ExerciseId, isExerciseTask, PositionTask } from '../../sim/course';
import { allowedFreePlay, freePlayTask } from '../../sim/free-play';
import { instructorLineText } from '../free/free-play.model';
import { factorContributions, forgottenFactor, NotebookFactor, NotebookStepId, tabs } from '../../sim/notebook';
import { Vector2 } from '../../sim/noise';
import { TurretCorrection } from '../../sim/shot-review';
import { formatScopeValue, reticleSubtensionScale, TurretMove } from '../../sim/scope-model';
import { InstructorSnapshot } from '../instructor/instructor-snapshot';
import { journalSeries } from '../journal/journal.model';
import { RadioPlateComponent } from '../instructor/radio-plate.component';
import { forgottenFactorRadio, offMarksRadio, RADIO_EMPTY_CHAMBER, RadioLine } from '../instructor/radio.model';
import { TeachingOverlayComponent } from '../instructor/teaching-overlay.component';
import { forgottenFactorTeaching, isFactorGuarded, nextTeaching, teachingScript, TeachingView } from '../instructor/teaching.model';
import { NotebookSheetComponent } from '../notebook/notebook-sheet.component';
import { CARTRIDGE_LETTERS, clockText, NotebookTab } from '../notebook/notebook.model';
import { aimLimitsMil } from '../scene/scene.model';
import { ScopeRenderer } from '../scene/scope-renderer';
import { FeedbackEvent, FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { ReviewSheetComponent } from '../review/review-sheet.component';
import { ResultSheetComponent } from '../result/result-sheet.component';
import { resultSheet, ResultSheetView } from '../result/result.model';
import { PositionSession, PositionShot } from './position-session';
import { BoltTrackComponent } from './bolt-track.component';
import { FireControlComponent } from './fire-control.component';
import { breathRing, correctionCells, drumCounterText, markerTarget, playability, pressureText, TurretAxis } from './position.model';
import { TurretDrumComponent } from './turret-drum.component';

const MARKS_ON_GLASS = 8;
const UI_REFRESH_S = 0.1;
const RADIO_MS = 4000;
const FREE_PLAY_ID = 'free';
const INSTRUCTOR_ON = 'on';
const STOP_BADGE_MS = 900;
const PINCH_STEP_PT = 40;
const RING_STEP_PT = 24;
const ZONE_TO_GLASS = 0.5;
const HOLD_LABELS = { free: 'Держать', holding: 'Держу', cooldown: 'Выдох' } as const;
const SEED_RANGE = 1_000_000_000;
const SHEET_GAP_BELOW_CROSSHAIR_PT = 24;
const CLICKS_PER_WHOLE_MIL = 10;
const CLICKS_PER_WHOLE_MOA = 4;
const CLICKS_PER_TURN = 100;
const BOLT_EVENT_FEEDBACK: Partial<Record<BoltEvent, FeedbackEvent>> = {
  unlock: 'bolt-unlock',
  slide: 'bolt-slide',
  eject: 'bolt-eject',
  feed: 'bolt-feed',
  lock: 'bolt-lock',
  magazine: 'magazine',
};

@Component({
  selector: 'or-position',
  imports: [
    IonContent,
    TurretDrumComponent,
    FireControlComponent,
    BoltTrackComponent,
    NotebookSheetComponent,
    ReviewSheetComponent,
    ResultSheetComponent,
    RadioPlateComponent,
    TeachingOverlayComponent,
  ],
  templateUrl: './position.page.html',
  styleUrl: './position.page.scss',
})
export class PositionPage {
  readonly exerciseId = input.required<string>();
  readonly instructor = input<string>();

  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private readonly progress = inject(ProgressStore);
  private readonly engine = new BallisticsEngine();
  private readonly glassCanvas = viewChild<ElementRef<HTMLCanvasElement>>('glass');
  private readonly positionRoot = viewChild<ElementRef<HTMLElement>>('positionRoot');

  protected readonly isFreePlay = computed(() => this.exerciseId() === FREE_PLAY_ID);
  protected readonly def = computed<PositionTask | null>(() =>
    this.isFreePlay()
      ? freePlayTask(allowedFreePlay(this.progress.freePlay(), courseProgress(this.progress.course(), this.progress.settings().isEverythingUnlocked).freePlayUnlocks))
      : (exerciseById(this.exerciseId() as ExerciseId) ?? null),
  );
  protected readonly session = signal<PositionSession | null>(null);
  protected readonly uiTick = signal(0);
  protected readonly radio = signal<RadioLine | null>(null);
  protected readonly stopBadge = signal<string | null>(null);
  protected readonly end = signal<ResultSheetView | null>(null);
  protected readonly isLeaveConfirmOpen = signal(false);
  protected readonly sheetTab = signal<NotebookTab | null>(null);
  protected readonly reviewedShot = signal<PositionShot | null>(null);
  protected readonly reviewFrame = signal<{ topPt: number; heightPt: number } | null>(null);
  protected readonly dopeNotes = computed(() => {
    const session = this.session();
    return session ? (this.progress.dopeNotes()[session.notebook.context.card.cartridgeId] ?? []) : [];
  });
  protected readonly sheetFrame = signal<{ topPt: number; heightPt: number } | null>(null);
  private readonly hasOpenedNotebook = signal(false);
  private readonly hasNotedDope = signal(false);
  protected readonly openCalcStep = signal<NotebookStepId | null>(null);
  private readonly acknowledgedSteps = signal<ReadonlySet<string>>(new Set());
  private readonly isTeachingSkipped = signal(false);
  private readonly guardedFactor = signal<NotebookFactor | null>(null);
  protected readonly teaching = computed<TeachingView | null>(() => {
    this.uiTick();
    const session = this.session();
    if (!session) {
      return null;
    }
    const factor = this.guardedFactor();
    if (factor && !session.notebook.factorsOn[factor]) {
      return forgottenFactorTeaching(factor, factorContributions(session.notebook)[factor]);
    }
    const script = isExerciseTask(session.def) ? teachingScript(session.def.id) : null;
    if (!script || this.instructor() !== INSTRUCTOR_ON || this.isTeachingSkipped() || session.isRepeatAfterRecalc) {
      return null;
    }
    return nextTeaching(script, this.acknowledgedSteps(), this.instructorSnapshot(session, session.def as ExerciseDef));
  });
  protected readonly isUnplayable = computed(() => {
    const def = this.def();
    return def === null || !playability(def).isPlayable;
  });

  protected readonly view = computed(() => {
    this.uiTick();
    const session = this.session();
    if (!session) {
      return null;
    }
    const scope = session.scope.scope;
    const entered = session.enteredTotal;
    const notebook = session.notebook;
    const playerDistanceM = notebook.distanceM === null ? null : Math.round(notebook.distanceM);
    const wind = notebook.readings.wind;
    const dial = { elevation: session.scope.elevation.clicks, windageLeft: session.scope.windage.clicks };
    const distanceText = notebook.context.target.distanceM === null ? 'дистанция неизвестна' : `${notebook.context.target.distanceM} м`;
    return {
      title: isExerciseTask(session.def) ? `Упр. ${session.def.id} · ${session.def.title}` : session.def.title,
      instructorLine: this.isFreePlay() && this.progress.freePlay().isInstructorNear ? instructorLineText(session.trueCorrection(this.scenarioTimeS(session))) : null,
      subtitle: `рубеж · ${distanceText} · цель ${session.firingLine.targetIndex + 1} / ${session.setup.targets.length}`,
      wind: wind ? [`${wind.speedMps.toFixed(1)} м/с`, clockText(wind.clock)] : [session.def.conditions.windScale === 0 ? 'штиль' : '—'],
      isWindUnfilled: !tabs(notebook).wind && session.def.conditions.windScale !== 0,
      isNotEntered: entered === null,
      cells: correctionCells(scope, dial, entered, playerDistanceM),
      elevation: {
        clicks: dial.elevation,
        target: entered?.elevation.targetClicks ?? null,
        min: session.scope.elevation.minClicks,
        text: `↑ ${formatScopeValue(scope, dial.elevation * scope.clickMrad)}`,
        counter: drumCounterText('elevation', session.progress('elevation')),
      },
      windage: {
        clicks: dial.windageLeft,
        target: entered?.windageLeft.targetClicks ?? null,
        min: session.scope.windage.minClicks,
        text: formatScopeValue(scope, Math.abs(dial.windageLeft) * scope.clickMrad),
        counter: drumCounterText('windage', session.progress('windage')),
      },
      magnification: session.scope.magnification,
      dope: playerDistanceM === null ? 'ДОПЕ · —' : `ДОПЕ · ${playerDistanceM} м ↑ ${dopeRowAt(notebook.context.card, notebook.distanceM!).elevationMil.toFixed(1)}`,
      rounds: `${session.firingLine.magazineLeft} / ${session.firingLine.magazineLoaded}`,
      isMagazineChangeDue: session.isMagazineChangeDue,
      isBoltCycleDue: !session.isTapTrigger && session.isBoltCycleDue && this.end() === null,
      boltStep: session.scope.bolt.currentStep,
      boltProgress: session.scope.bolt.progress,
      triggerMode: session.def.trigger,
      pressure: session.scope.trigger?.pressure ?? 0,
      pressureLabel: pressureText(session.scope.trigger?.pressure ?? 0),
      breath: breathRing(session.scope.sway.breath.state, session.scope.sway.breath.heldS),
      holdLabel: HOLD_LABELS[session.scope.sway.breath.state],
      zone: this.zoneView(session),
    };
  });

  private readonly marks: Correction[] = [];
  private compactSheetFrame: { topPt: number; heightPt: number } | null = null;
  private fingerMarker: Vector2 | null = null;
  private renderer: ScopeRenderer | null = null;
  private frameHandle = 0;
  private lastFrameMs = 0;
  private uiAccumulatorS = 0;
  private startedAtMs = 0;
  private attempt = 0;
  private isFiring = false;
  private radioTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCorrection: TurretCorrection | null = null;
  private dialAtLastShot = { elevation: 0, windageLeft: 0 };
  private aimLimitsKey = '';
  private seriesStartedAtIso = new Date().toISOString();
  private savedSeriesSession: PositionSession | null = null;
  private aimLimitsSession: PositionSession | null = null;
  private readonly glassPointers = new Map<number, Vector2>();
  private pinchDistancePt: number | null = null;
  private ringDrag: { lastPt: number; remainderPt: number } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.saveSeries();
      cancelAnimationFrame(this.frameHandle);
      if (this.radioTimer) {
        clearTimeout(this.radioTimer);
      }
    });
    afterNextRender(() => void this.begin());
  }

  protected turn(axis: TurretAxis, clicks: number): void {
    const session = this.session();
    if (!session || this.end()) {
      return;
    }
    const before = axis === 'elevation' ? session.scope.elevation.clicks : session.scope.windage.clicks;
    const move: TurretMove = session.turn(axis, clicks);
    this.emitDrumFeedback(before, move, session.scope.scope.units === 'MIL' ? CLICKS_PER_WHOLE_MIL : CLICKS_PER_WHOLE_MOA);
    this.refresh();
  }

  protected zoom(direction: 1 | -1): void {
    const scope = this.session()?.scope;
    if (!scope) {
      return;
    }
    const before = scope.magnification;
    scope.zoom(direction);
    if (scope.magnification !== before) {
      this.feedback.emit('detent');
    }
    this.refresh();
  }

  protected breathDown(): void {
    this.session()?.scope.sway.breath.press();
  }

  protected breathUp(): void {
    this.session()?.scope.sway.breath.release();
  }

  protected openSheet(tab: NotebookTab): void {
    if (!this.session() || this.end()) {
      return;
    }
    const glass = this.glassCanvas()?.nativeElement.getBoundingClientRect();
    const root = this.positionRoot()?.nativeElement.getBoundingClientRect();
    if (glass && root) {
      const crosshairY = glass.top + glass.height / 2 + SHEET_GAP_BELOW_CROSSHAIR_PT;
      this.sheetFrame.set({ topPt: crosshairY - root.top, heightPt: window.innerHeight - crosshairY });
    }
    this.fingerMarker = null;
    this.hasOpenedNotebook.set(true);
    this.sheetTab.set(tab);
  }

  protected closeSheet(): void {
    this.sheetTab.set(null);
    this.openCalcStep.set(null);
  }

  protected setSheetExpanded(isExpanded: boolean): void {
    const frame = this.fullFrame();
    if (isExpanded && frame) {
      this.compactSheetFrame = this.sheetFrame();
      this.sheetFrame.set(frame);
    } else if (!isExpanded && this.compactSheetFrame) {
      this.sheetFrame.set(this.compactSheetFrame);
    }
  }

  protected enterOnTurrets(): void {
    const session = this.session();
    if (!session || this.isFactorForgotten(session)) {
      return;
    }
    session.enterOnTurrets();
    this.closeSheet();
    this.refresh();
  }

  protected measureStation(holdS: number): void {
    const session = this.session();
    if (session) {
      session.measureStation(holdS, this.scenarioTimeS(session));
      this.refresh();
    }
  }

  protected async fire(): Promise<void> {
    const session = this.session();
    if (!session || this.isFiring || session.isMagazineChangeDue || session.isFinished || this.sheetTab() !== null || this.reviewedShot() !== null) {
      return;
    }
    if (this.isFactorForgotten(session)) {
      return;
    }
    this.isFiring = true;
    const offMarks = offMarksRadio(session.progress('elevation'), session.progress('windage'));
    const shot = await session.fire(this.scenarioTimeS(session));
    this.isFiring = false;
    if (!shot) {
      this.feedback.emit('empty-chamber');
      return;
    }
    this.feedback.emit('shot');
    if (offMarks) {
      this.showRadio(offMarks);
    }
    this.lastCorrection = shot.review.correction;
    this.dialAtLastShot = { elevation: session.scope.elevation.clicks, windageLeft: session.scope.windage.clicks };
    this.feedback.scheduleImpact(shot.record.isHit, impactSoundDelayS(shot.result.timeOfFlightS, shot.record.distanceM, session.scenario.atmosphere.temperatureC));
    for (const boltEvent of shot.boltEvents) {
      const feedbackEvent = BOLT_EVENT_FEEDBACK[boltEvent];
      if (feedbackEvent) {
        this.feedback.emit(feedbackEvent);
      }
    }
    this.marks.unshift(shot.result.impact);
    this.marks.length = Math.min(this.marks.length, MARKS_ON_GLASS);
    this.closeSheet();
    this.fingerMarker = null;
    this.reviewFrame.set(this.fullFrame());
    this.reviewedShot.set(shot);
    this.refresh();
  }

  protected closeReview(): void {
    const session = this.session();
    this.reviewedShot.set(null);
    const result = session?.result();
    if (session && result && isExerciseTask(session.def)) {
      const courseBefore = this.progress.course();
      this.progress.recordExerciseResult(session.def.id, result.exerciseClass, result.total);
      this.saveSeries();
      this.reviewFrame.set(this.fullFrame());
      this.end.set(resultSheet({ def: session.def, result, records: session.records, courseBefore, courseAfter: this.progress.course() }));
    }
    this.refresh();
  }

  protected async recalcAndRepeat(): Promise<void> {
    const session = this.session();
    if (!session) {
      return;
    }
    this.saveSeries();
    const repeat = await session.restartForRecalc(this.engine);
    this.seriesStartedAtIso = new Date().toISOString();
    this.reviewedShot.set(null);
    this.end.set(null);
    this.marks.length = 0;
    this.startedAtMs = performance.now();
    this.session.set(repeat);
    this.refresh();
  }

  protected saveDopeNote(): void {
    const review = this.reviewedShot()?.review;
    if (review && review.dopeNoteMil !== null) {
      this.hasNotedDope.set(true);
      this.progress.addDopeNote(review.cartridgeId, review.distanceM, review.dopeNoteMil);
    }
  }

  protected pressTrigger(fingerOffset: Vector2): void {
    const session = this.session();
    if (!session || session.isFinished || this.sheetTab() !== null || this.reviewedShot() !== null || this.isFactorForgotten(session)) {
      return;
    }
    if (!session.startTrigger()) {
      this.feedback.emit('empty-chamber');
      this.showBoltHint();
      return;
    }
    this.fingerMarker = markerTarget(fingerOffset);
  }

  protected moveTrigger(fingerOffset: Vector2): void {
    if (this.fingerMarker) {
      this.fingerMarker = markerTarget(fingerOffset);
    }
  }

  protected releaseTrigger(): void {
    this.fingerMarker = null;
  }

  protected dragBolt(delta: Vector2): void {
    const session = this.session();
    if (!session) {
      return;
    }
    const result = session.dragBolt(delta.x, delta.y, performance.now() / 1000);
    for (const boltEvent of result.events) {
      const feedbackEvent = BOLT_EVENT_FEEDBACK[boltEvent];
      if (feedbackEvent) {
        this.feedback.emit(feedbackEvent);
      }
    }
    this.refresh();
  }

  protected showBoltHint(): void {
    this.showRadio(RADIO_EMPTY_CHAMBER);
  }

  protected dismissRadio(): void {
    this.radio.set(null);
  }

  protected acknowledgeTeaching(): void {
    const view = this.teaching();
    if (view) {
      this.acknowledgedSteps.update(ids => new Set([...ids, view.id]));
    }
  }

  protected skipTeaching(): void {
    this.isTeachingSkipped.set(true);
  }

  protected changeMagazine(): void {
    const session = this.session();
    if (!session?.isMagazineChangeDue) {
      return;
    }
    for (const boltEvent of session.changeMagazine()) {
      const feedbackEvent = BOLT_EVENT_FEEDBACK[boltEvent];
      if (feedbackEvent) {
        this.feedback.emit(feedbackEvent);
      }
    }
    this.refresh();
  }

  protected back(): void {
    if (this.sheetTab() !== null) {
      this.closeSheet();
      return;
    }
    const session = this.session();
    if (session && session.hasFired && !session.isFinished && !this.isFreePlay()) {
      this.isLeaveConfirmOpen.set(true);
      return;
    }
    this.leave();
  }

  protected stay(): void {
    this.isLeaveConfirmOpen.set(false);
  }

  protected leave(): void {
    this.isLeaveConfirmOpen.set(false);
    this.saveSeries();
    void this.router.navigate(this.isFreePlay() ? ['/free'] : ['/course', this.exerciseId()]);
  }

  protected toTrail(): void {
    void this.router.navigate(['/course']);
  }

  protected toBriefing(): void {
    void this.router.navigate(['/course', this.exerciseId()]);
  }

  protected toJournal(): void {
    void this.router.navigate(['/journal']);
  }

  protected seriesRadiusMil(session: PositionSession): number {
    return targetRadiusMrad(session.setup.targets[0]);
  }

  protected glassDown(event: PointerEvent): void {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.glassPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pinchDistancePt = this.glassPointers.size === 2 ? this.pointerSpreadPt() : null;
  }

  protected glassMove(event: PointerEvent): void {
    const previous = this.glassPointers.get(event.pointerId);
    const session = this.session();
    if (!previous || !session) {
      return;
    }
    this.glassPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.glassPointers.size === 2 && this.pinchDistancePt !== null) {
      const spreadPt = this.pointerSpreadPt();
      const steps = Math.trunc((spreadPt - this.pinchDistancePt) / PINCH_STEP_PT);
      if (steps !== 0) {
        this.pinchDistancePt += steps * PINCH_STEP_PT;
        this.zoomSteps(steps);
      }
      return;
    }
    session.scope.dragPicture(event.clientX - previous.x, event.clientY - previous.y);
  }

  protected glassUp(event: PointerEvent): void {
    this.glassPointers.delete(event.pointerId);
    this.pinchDistancePt = null;
  }

  protected ringDown(event: PointerEvent): void {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.ringDrag = { lastPt: event.clientX, remainderPt: 0 };
  }

  protected ringMove(event: PointerEvent): void {
    const drag = this.ringDrag;
    if (!drag) {
      return;
    }
    drag.remainderPt += event.clientX - drag.lastPt;
    drag.lastPt = event.clientX;
    const steps = Math.trunc(drag.remainderPt / RING_STEP_PT);
    if (steps !== 0) {
      drag.remainderPt -= steps * RING_STEP_PT;
      this.zoomSteps(steps);
    }
  }

  protected ringUp(): void {
    this.ringDrag = null;
  }

  private async begin(): Promise<void> {
    if (this.isUnplayable()) {
      return;
    }
    await this.startSession();
    this.startLoop();
  }

  private async startSession(): Promise<void> {
    const settings = this.progress.settings();
    this.attempt++;
    const seed = (Date.now() + this.attempt) % SEED_RANGE;
    const session = await PositionSession.start({
      def: this.def()!,
      seed,
      engine: this.engine,
      accessibility: { isZoneLarger: settings.isTriggerZoneLarger, isMarkerDriftOff: settings.isMarkerDriftOff },
    });
    this.startedAtMs = performance.now();
    this.seriesStartedAtIso = new Date().toISOString();
    this.session.set(session);
    this.refresh();
  }

  private saveSeries(): void {
    const session = this.session();
    if (!session || session === this.savedSeriesSession) {
      return;
    }
    const series = journalSeries({
      id: `${this.seriesStartedAtIso}-${session.scenario.seed}`,
      task: session.def,
      startedAtIso: this.seriesStartedAtIso,
      records: session.records,
      result: session.result(),
    });
    if (series) {
      this.savedSeriesSession = session;
      this.progress.addSeries(series);
    }
  }

  private startLoop(): void {
    const canvas = this.glassCanvas()?.nativeElement;
    if (!canvas) {
      return;
    }
    this.renderer = new ScopeRenderer(canvas);
    this.lastFrameMs = performance.now();
    const frame = (nowMs: number): void => {
      const dtS = Math.min(0.05, (nowMs - this.lastFrameMs) / 1000);
      this.lastFrameMs = nowMs;
      const session = this.session();
      if (session) {
        if (session.step(dtS, this.fingerMarker)) {
          this.fingerMarker = null;
          void this.fire();
        }
        this.draw(session);
      }
      this.uiAccumulatorS += dtS;
      if (this.uiAccumulatorS >= UI_REFRESH_S) {
        this.uiAccumulatorS = 0;
        this.refresh();
      }
      this.frameHandle = requestAnimationFrame(frame);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  private draw(session: PositionSession): void {
    this.keepAimInScene(session);
    const zones = windAt(session.scenario, this.scenarioTimeS(session));
    this.renderer?.draw({
      scope: session.scope.scope,
      ptPerMil: session.scope.ptPerMil,
      reticleScale: reticleSubtensionScale(session.scope.scope, session.scope.magnification),
      targetOffsetPt: session.scope.targetOffsetPt,
      targetRadiusMil: targetRadiusMrad(session.target),
      targetDistanceM: session.target.distanceM,
      nearWindMps: lateralWindMps(zones[0]),
      marks: this.marks,
      flags: session.scenario.flags.map((flag, index) => ({ distanceM: flag.distanceM, lateralWindMps: lateralWindMps(zones[index + 1]) })),
      timeS: performance.now() / 1000,
    });
  }

  private keepAimInScene(session: PositionSession): void {
    const radiusMil = targetRadiusMrad(session.target);
    const key = `${session.target.distanceM}:${radiusMil}:${session.scope.magnification}`;
    if (key !== this.aimLimitsKey || session !== this.aimLimitsSession) {
      this.aimLimitsKey = key;
      this.aimLimitsSession = session;
      session.scope.setAimLimits(aimLimitsMil(session.target.distanceM, radiusMil, session.scope.magnification));
    }
  }

  private zoneView(session: PositionSession): { radius: number; markerX: number; markerY: number } | null {
    const trigger = session.scope.trigger;
    if (!trigger) {
      return null;
    }
    return {
      radius: trigger.radiusPt(session.scope.heart.bpm) * ZONE_TO_GLASS,
      markerX: trigger.marker.x * ZONE_TO_GLASS,
      markerY: trigger.marker.y * ZONE_TO_GLASS,
    };
  }

  private scenarioTimeS(session: PositionSession): number {
    return session.scenario.startTimeS + (performance.now() - this.startedAtMs) / 1000;
  }

  private zoomSteps(steps: number): void {
    const direction = steps > 0 ? 1 : -1;
    for (let step = 0; step < Math.abs(steps); step++) {
      this.zoom(direction);
    }
  }

  private pointerSpreadPt(): number {
    const [first, second] = [...this.glassPointers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private emitDrumFeedback(beforeClicks: number, move: TurretMove, clicksPerWholeUnit: number): void {
    if (move.appliedClicks !== 0) {
      const afterClicks = beforeClicks + move.appliedClicks;
      const hasCrossedTurn = Math.floor(afterClicks / CLICKS_PER_TURN) !== Math.floor(beforeClicks / CLICKS_PER_TURN);
      const hasCrossedWhole = Math.floor(afterClicks / clicksPerWholeUnit) !== Math.floor(beforeClicks / clicksPerWholeUnit);
      this.feedback.emit(hasCrossedTurn ? 'drum-turn' : hasCrossedWhole ? 'drum-whole-mil' : 'drum-click');
    }
    if (move.stop) {
      this.feedback.emit('drum-stop');
      this.stopBadge.set(move.stop === 'zero' ? 'ZERO STOP' : move.stop === 'top' ? 'УПОР ВВЕРХ' : 'УПОР');
      setTimeout(() => this.stopBadge.set(null), STOP_BADGE_MS);
    }
  }

  private fullFrame(): { topPt: number; heightPt: number } | null {
    const root = this.positionRoot()?.nativeElement.getBoundingClientRect();
    return root ? { topPt: 0, heightPt: window.innerHeight - root.top } : null;
  }

  private showRadio(line: RadioLine): void {
    this.radio.set(line);
    if (line.isImportant) {
      this.feedback.emit('radio');
    }
    if (this.radioTimer) {
      clearTimeout(this.radioTimer);
    }
    this.radioTimer = setTimeout(() => this.radio.set(null), RADIO_MS);
  }

  private isFactorForgotten(session: PositionSession): boolean {
    const factor = isExerciseTask(session.def) && isFactorGuarded(session.def.id) && session.notebook.mode === 'auto' ? forgottenFactor(session.notebook) : null;
    if (!factor) {
      return false;
    }
    this.guardedFactor.set(factor);
    this.showRadio(forgottenFactorRadio(factor));
    if (this.sheetTab() !== 'total') {
      this.openSheet('total');
    }
    return true;
  }

  private instructorSnapshot(session: PositionSession, exercise: ExerciseDef): InstructorSnapshot {
    const entered = session.enteredTotal;
    return {
      exerciseId: exercise.id,
      sheetTab: this.sheetTab(),
      hasOpenedNotebook: this.hasOpenedNotebook(),
      isEntered: entered !== null,
      dopeMil: factorContributions(session.notebook).dope.mil,
      elevation: session.progress('elevation'),
      windageTargetClicks: entered?.windageLeft.targetClicks ?? null,
      shotsFired: session.records.length,
      isReviewOpen: this.reviewedShot() !== null,
      isResultOpen: this.end() !== null,
      isBoltCycleDue: !session.isTapTrigger && session.isBoltCycleDue,
      lastCorrection: this.lastCorrection,
      turnedSinceShot: {
        upClicks: session.scope.elevation.clicks - this.dialAtLastShot.elevation,
        rightClicks: this.dialAtLastShot.windageLeft - session.scope.windage.clicks,
      },
      aimOffMil: Math.hypot(session.scope.aim.x, session.scope.aim.y),
      ...this.notebookFacts(session),
    };
  }

  private notebookFacts(session: PositionSession): Pick<
    InstructorSnapshot,
    | 'isStationMeasured'
    | 'stationSpeedMps'
    | 'windSpeedMps'
    | 'reticleMil'
    | 'measuredDistanceM'
    | 'targetSizeM'
    | 'recordedSteps'
    | 'stageIndex'
    | 'isMagazineChangeDue'
    | 'cartridgeLetter'
    | 'nextCartridgeLetter'
    | 'isCallMarked'
    | 'isDopeNoted'
    | 'openCalcStep'
  > {
    const notebook = session.notebook;
    const station = notebook.readings.station;
    const stageIndex = session.firingLine.stageIndex;
    const nextStage = session.def.stages[stageIndex + 1];
    const lastRecord = session.records[session.records.length - 1];
    return {
      isStationMeasured: station !== null && !station.isShort,
      stationSpeedMps: station?.windSpeedMps ?? null,
      windSpeedMps: notebook.readings.wind?.speedMps ?? null,
      reticleMil: notebook.readings.reticleMil,
      measuredDistanceM: notebook.readings.reticleMil !== null ? notebook.distanceM : null,
      targetSizeM: notebook.context.target.sizeM,
      recordedSteps: (Object.keys(notebook.steps) as NotebookStepId[]).filter(step => notebook.steps[step].isRecorded),
      stageIndex,
      isMagazineChangeDue: session.isMagazineChangeDue,
      cartridgeLetter: CARTRIDGE_LETTERS[session.firingLine.cartridgeId],
      nextCartridgeLetter: nextStage ? CARTRIDGE_LETTERS[nextStage.cartridgeId] : null,
      isCallMarked: lastRecord?.isCallAccurate !== undefined,
      isDopeNoted: this.hasNotedDope(),
      openCalcStep: this.openCalcStep(),
    };
  }

  protected refresh(): void {
    const factor = this.guardedFactor();
    if (factor && this.session()?.notebook.factorsOn[factor]) {
      this.guardedFactor.set(null);
    }
    this.uiTick.update(tick => tick + 1);
  }
}
