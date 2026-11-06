import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonModal } from '@ionic/angular/standalone';
import { TARGETS, targetRadiusMrad } from '../../core/content';
import { impactSoundDelayS } from '../../core/field';
import { lateralWindMps, windAt } from '../../core/scenario';
import { shotPoints } from '../../core/score';
import { resolveShot } from '../../core/shot';
import { Correction } from '../../core/types';
import { BOLT_STEP_DIRECTION, BOLT_STEP_TRAVEL_PT, BOLT_STEPS, BoltEvent, BoltStep, ChamberState } from '../../sim/bolt';
import { Vector2 } from '../../sim/noise';
import {
  DRUM_DRAG_PT_PER_CLICK,
  formatScopeValue,
  isHoldoverSettled,
  reticleSubtensionScale,
  ScopeId,
  SCOPES,
  scopeById,
  TurretMove,
} from '../../sim/scope-model';
import { ScopeSession } from '../../sim/scope-session';
import { hasZoneWind, maxScore } from '../../sim/tasks';
import { MARKER_LIMIT_PT } from '../../sim/trigger';
import { DebriefView } from '../debrief/debrief-view';
import { FeedbackEvent, FeedbackService } from '../services/feedback.service';
import { GameSession } from '../services/game-session';
import { ProgressStore, ShotRecord, TaskResult } from '../services/progress.store';
import { ScopeRenderer } from './scope-renderer';

type PanelMode = 'controls' | 'trigger' | 'bolt' | 'finished';

const MARKS_ON_GLASS = 8;
const UI_REFRESH_S = 0.1;
const PAD_SIZE_PT = 300;
const CLICKS_PER_MIL = 10;
const CLICKS_PER_MOA = 4;
const CLICKS_PER_TURN = 100;
const BOLT_EVENT_FEEDBACK: Partial<Record<BoltEvent, FeedbackEvent>> = {
  unlock: 'bolt-unlock',
  slide: 'bolt-slide',
  eject: 'bolt-eject',
  feed: 'bolt-feed',
  lock: 'bolt-lock',
  magazine: 'magazine',
};
const BOLT_BALL_HOME: Vector2 = { x: 110, y: 46 };
const BOLT_VIEWBOX_WIDTH = 360;

@Component({
  selector: 'or-scope',
  imports: [IonContent, IonModal, DebriefView],
  templateUrl: './scope.page.html',
  styleUrl: './scope.page.scss',
})
export class ScopePage {
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private readonly progress = inject(ProgressStore);
  protected readonly game = inject(GameSession);
  private readonly glassCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('glass');
  private readonly padCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pad');

  protected readonly scopes = SCOPES;
  protected readonly targets = TARGETS;
  protected readonly padSize = PAD_SIZE_PT;
  protected readonly boltSteps = BOLT_STEPS;

  protected readonly session = new ScopeSession(
    this.game.scope(),
    this.game.task().restingBpm,
    this.game.scenario().seed,
    { isZoneLarger: this.progress.settings().isTriggerZoneLarger, isMarkerDriftOff: this.progress.settings().isMarkerDriftOff },
  );
  protected readonly panel = signal<PanelMode>('controls');
  protected readonly uiTick = signal(0);
  protected readonly stopBadge = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly debriefShot = signal<ShotRecord | null>(null);
  protected readonly taskResult = signal<TaskResult | null>(null);
  private readonly marks: Correction[] = [];
  private finger: Vector2 | null = null;
  private renderer: ScopeRenderer | null = null;
  private frameHandle = 0;
  private lastFrameMs = 0;
  private uiAccumulatorS = 0;
  private drumDrag: { axis: 'elevation' | 'windage'; lastPt: number; remainderPt: number } | null = null;
  private pictureDrag: Vector2 | null = null;
  private boltDrag: Vector2 | null = null;
  private boltSvgUnitsPerPx = 1;
  private isFiring = false;

  protected readonly view = computed(() => {
    this.uiTick();
    const session = this.session;
    const scope = session.scope;
    const solution = this.game.solution();
    const dial = session.dial;
    const requiredUp = solution?.required.upMrad ?? 0;
    const requiredRight = solution?.required.rightMrad ?? 0;
    const holdUp = requiredUp - dial.upMrad;
    const holdRight = requiredRight - dial.rightMrad;
    const sideOf = (rightMrad: number): string => (rightMrad < 0 ? 'L' : 'R');
    return {
      scopeName: scope.name,
      focal: `${scope.isFirstFocalPlane ? 'FFP' : 'SFP'} · ${scope.units}`,
      trueAt: scope.isFirstFocalPlane ? null : `верно на ${scope.magnificationMax}×`,
      magnification: session.magnification,
      bpm: Math.round(session.heart.bpm),
      breathState: session.sway.breath.state,
      breathHeldS: session.sway.breath.heldS,
      elevationText: formatScopeValue(scope, dial.upMrad),
      elevationClicks: session.elevation.clicks,
      windText: `${formatScopeValue(scope, Math.abs(dial.rightMrad))} ${dial.rightMrad === 0 ? '' : sideOf(dial.rightMrad)}`,
      windClicks: Math.abs(session.windage.clicks),
      calcText: solution ? `↑${formatScopeValue(scope, requiredUp)} →${formatScopeValue(scope, Math.abs(requiredRight))} ${sideOf(requiredRight)}` : '—',
      dialText: `↑${formatScopeValue(scope, dial.upMrad)} →${formatScopeValue(scope, Math.abs(dial.rightMrad))} ${sideOf(dial.rightMrad)}`,
      holdText: `↑${formatScopeValue(scope, holdUp)} →${formatScopeValue(scope, Math.abs(holdRight))} ${sideOf(holdRight)}`,
      isHoldSettled: isHoldoverSettled(scope, holdUp) && isHoldoverSettled(scope, holdRight),
      pressurePercent: Math.round((session.trigger?.pressure ?? 0) * 100),
      isMarkerInside: session.trigger?.isMarkerInside(session.heart.bpm) ?? false,
      rounds: session.bolt.rounds,
      chamber: session.bolt.chamberState,
      boltStep: session.bolt.currentStep,
      boltBall: this.boltBallPosition(session.bolt.currentStep, session.bolt.progress),
      averageCycleS: session.bolt.averageCycleTimeS,
      shotsLeft: this.game.shotsLeft(),
      score: this.game.taskScore(),
    };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frameHandle));
    afterNextRender(() => this.startLoop());
  }

  protected selectScope(id: ScopeId): void {
    this.game.scopeId.set(id);
    this.session.setScope(scopeById(id));
    this.refresh();
  }

  protected selectTarget(index: number): void {
    this.game.selectTarget(index);
    this.marks.length = 0;
  }

  protected zoom(direction: 1 | -1): void {
    this.session.zoom(direction);
    this.refresh();
  }

  protected resetAim(): void {
    this.session.resetAim();
    this.marks.length = 0;
    this.refresh();
  }

  protected breathDown(): void {
    this.session.sway.breath.press();
  }

  protected breathUp(): void {
    this.session.sway.breath.release();
  }

  protected openTrigger(): void {
    if (!this.session.startTrigger()) {
      this.feedback.emit('empty-chamber');
      this.message.set(this.session.bolt.chamberState === 'spent' ? 'Перезарядите затвор' : 'Ствол пуст');
      this.panel.set('bolt');
      return;
    }
    this.message.set(null);
    this.panel.set('trigger');
  }

  protected cancelTrigger(): void {
    this.session.cancelTrigger();
    this.finger = null;
    this.panel.set('controls');
  }

  protected padDown(event: PointerEvent): void {
    (event.target as Element).setPointerCapture(event.pointerId);
    this.finger = this.padPoint(event);
  }

  protected padMove(event: PointerEvent): void {
    if (this.finger) {
      this.finger = this.padPoint(event);
    }
  }

  protected padUp(): void {
    this.finger = null;
  }

  protected drumDown(event: PointerEvent, axis: 'elevation' | 'windage'): void {
    (event.target as Element).setPointerCapture(event.pointerId);
    this.drumDrag = { axis, lastPt: axis === 'elevation' ? event.clientX : event.clientY, remainderPt: 0 };
  }

  protected drumMove(event: PointerEvent): void {
    const drag = this.drumDrag;
    if (!drag) {
      return;
    }
    const positionPt = drag.axis === 'elevation' ? event.clientX : event.clientY;
    const deltaPt = drag.axis === 'elevation' ? positionPt - drag.lastPt : drag.lastPt - positionPt;
    drag.lastPt = positionPt;
    drag.remainderPt += deltaPt;
    const clicks = Math.trunc(drag.remainderPt / DRUM_DRAG_PT_PER_CLICK);
    if (clicks !== 0) {
      drag.remainderPt -= clicks * DRUM_DRAG_PT_PER_CLICK;
      this.turn(drag.axis, clicks);
    }
  }

  protected drumUp(): void {
    this.drumDrag = null;
  }

  protected turn(axis: 'elevation' | 'windage', clicks: number): void {
    const before = axis === 'elevation' ? this.session.elevation.clicks : this.session.windage.clicks;
    const move: TurretMove = axis === 'elevation' ? this.session.turnElevation(clicks) : this.session.turnWindageLeft(clicks);
    const after = before + move.appliedClicks;
    if (move.appliedClicks !== 0) {
      const clicksPerWholeUnit = this.session.scope.units === 'MIL' ? CLICKS_PER_MIL : CLICKS_PER_MOA;
      const crossedWhole = Math.floor(after / clicksPerWholeUnit) !== Math.floor(before / clicksPerWholeUnit);
      const crossedTurn = Math.floor(after / CLICKS_PER_TURN) !== Math.floor(before / CLICKS_PER_TURN);
      this.feedback.emit(crossedTurn ? 'drum-turn' : crossedWhole ? 'drum-whole-mil' : 'drum-click');
    }
    if (move.stop) {
      this.feedback.emit('drum-stop');
      this.stopBadge.set(move.stop === 'zero' ? 'ZERO STOP' : move.stop === 'top' ? 'УПОР ВВЕРХ' : 'УПОР');
      setTimeout(() => this.stopBadge.set(null), 900);
    }
    this.refresh();
  }

  protected glassDown(event: PointerEvent): void {
    (event.target as Element).setPointerCapture(event.pointerId);
    this.pictureDrag = { x: event.clientX, y: event.clientY };
  }

  protected glassMove(event: PointerEvent): void {
    if (!this.pictureDrag) {
      return;
    }
    this.session.dragPicture(event.clientX - this.pictureDrag.x, event.clientY - this.pictureDrag.y);
    this.pictureDrag = { x: event.clientX, y: event.clientY };
  }

  protected glassUp(): void {
    this.pictureDrag = null;
  }

  protected boltDown(event: PointerEvent): void {
    const ball = event.target as SVGGraphicsElement;
    ball.setPointerCapture(event.pointerId);
    this.boltDrag = { x: event.clientX, y: event.clientY };
    this.boltSvgUnitsPerPx = BOLT_VIEWBOX_WIDTH / (ball.ownerSVGElement?.getBoundingClientRect().width || BOLT_VIEWBOX_WIDTH);
  }

  protected boltMove(event: PointerEvent): void {
    if (!this.boltDrag) {
      return;
    }
    const deltaX = (event.clientX - this.boltDrag.x) * this.boltSvgUnitsPerPx;
    const deltaY = (event.clientY - this.boltDrag.y) * this.boltSvgUnitsPerPx;
    const result = this.session.bolt.drag(deltaX, deltaY, performance.now() / 1000);
    this.boltDrag = { x: event.clientX, y: event.clientY };
    for (const boltEvent of result.events) {
      const feedbackEvent = BOLT_EVENT_FEEDBACK[boltEvent];
      if (feedbackEvent) {
        this.feedback.emit(feedbackEvent);
      }
      if (boltEvent === 'feed-empty') {
        this.message.set('Патронов нет: затвор встал вперёд пустым');
      }
    }
    if (result.stepCompleted === 'down') {
      this.session.knockAimAfterCycle();
      if (this.session.bolt.canFire) {
        this.message.set(null);
        this.panel.set('controls');
      }
    }
    this.refresh();
  }

  protected boltUp(): void {
    this.boltDrag = null;
  }

  protected insertMagazine(): void {
    for (const boltEvent of this.session.bolt.insertMagazine()) {
      this.feedback.emit(BOLT_EVENT_FEEDBACK[boltEvent]!);
    }
    this.message.set(null);
    this.refresh();
  }

  protected closeDebrief(): void {
    this.debriefShot.set(null);
    if (this.game.shotsLeft() <= 0) {
      this.finishTask();
      return;
    }
    this.panel.set(this.session.bolt.canFire ? 'controls' : 'bolt');
  }

  protected toDope(): void {
    this.debriefShot.set(null);
    void this.router.navigate(['/tabs/dope']);
  }

  protected leave(): void {
    void this.router.navigate(['/tabs/calc']);
  }

  protected toHub(): void {
    void this.router.navigate(['/tabs/hub']);
  }

  protected retry(): void {
    this.game.startTask(this.game.task());
    this.taskResult.set(null);
    this.marks.length = 0;
    void this.router.navigate(['/tabs/hub/weather']);
  }

  protected chamberText(chamber: ChamberState): string {
    const texts: Record<ChamberState, string> = { live: 'патрон в стволе', spent: 'гильза в стволе', empty: 'ствол пуст' };
    return texts[chamber];
  }

  protected starsText(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  protected boltStepLabel(step: BoltStep, index: number): string {
    const names: Record<BoltStep, string> = { up: 'ВВЕРХ', back: 'НАЗАД', forward: 'ВПЕРЁД', down: 'ВНИЗ' };
    return `${index + 1} ${names[step]}`;
  }

  protected isBoltStepDone(index: number): boolean {
    return index < BOLT_STEPS.indexOf(this.view().boltStep);
  }

  private finishTask(): void {
    const task = this.game.task();
    if (task.kind === 'free') {
      this.panel.set('bolt');
      return;
    }
    this.taskResult.set(this.progress.recordTaskResult(task.id, this.game.taskScore(), maxScore(task)));
    this.panel.set('finished');
  }

  private refresh(): void {
    this.uiTick.update(tick => tick + 1);
  }

  private padPoint(event: PointerEvent): Vector2 {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = (MARKER_LIMIT_PT * 2) / rect.width;
    return { x: (event.clientX - rect.left - rect.width / 2) * scale, y: (event.clientY - rect.top - rect.height / 2) * scale };
  }

  private boltBallPosition(step: BoltStep, progress: number): Vector2 {
    const raised = { x: BOLT_BALL_HOME.x, y: BOLT_BALL_HOME.y - BOLT_STEP_TRAVEL_PT.up };
    const back = { x: raised.x + BOLT_STEP_TRAVEL_PT.back, y: raised.y };
    const starts: Record<BoltStep, Vector2> = { up: BOLT_BALL_HOME, back: raised, forward: back, down: raised };
    const direction = BOLT_STEP_DIRECTION[step];
    const travel = BOLT_STEP_TRAVEL_PT[step] * progress;
    return { x: starts[step].x + direction.x * travel, y: starts[step].y + direction.y * travel };
  }

  private startLoop(): void {
    this.renderer = new ScopeRenderer(this.glassCanvas().nativeElement);
    this.lastFrameMs = performance.now();
    const frame = (nowMs: number): void => {
      const dtS = Math.min(0.05, (nowMs - this.lastFrameMs) / 1000);
      this.lastFrameMs = nowMs;
      const hasFired = this.session.step(dtS, this.finger);
      if (hasFired && !this.isFiring) {
        void this.fire();
      }
      this.draw();
      this.uiAccumulatorS += dtS;
      if (this.uiAccumulatorS >= UI_REFRESH_S || this.panel() === 'trigger') {
        this.uiAccumulatorS = 0;
        this.refresh();
      }
      this.frameHandle = requestAnimationFrame(frame);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  private draw(): void {
    const task = this.game.task();
    const scenario = this.game.scenario();
    const zones = windAt(scenario, this.game.scenarioTimeS());
    this.renderer?.draw({
      scope: this.session.scope,
      ptPerMil: this.session.ptPerMil,
      reticleScale: reticleSubtensionScale(this.session.scope, this.session.magnification),
      targetOffsetPt: this.session.targetOffsetPt,
      targetRadiusMil: targetRadiusMrad(this.game.target()),
      marks: this.marks,
      flags: hasZoneWind(task) ? scenario.flags.map((flag, index) => ({ distanceM: flag.distanceM, lateralWindMps: lateralWindMps(zones[index + 1]) })) : [],
      timeS: performance.now() / 1000,
      isDayTheme: this.progress.settings().theme === 'day',
    });
    this.drawPad();
  }

  private drawPad(): void {
    const canvas = this.padCanvas()?.nativeElement;
    const trigger = this.session.trigger;
    if (!canvas || !trigger) {
      return;
    }
    const context = canvas.getContext('2d')!;
    const size = PAD_SIZE_PT * 2;
    const scale = size / (MARKER_LIMIT_PT * 2);
    const center = size / 2;
    canvas.width = size;
    canvas.height = size;
    const background = context.createRadialGradient(center, center, 40, center, center, center);
    background.addColorStop(0, '#14181c');
    background.addColorStop(1, '#07080a');
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
    const radius = trigger.radiusPt(this.session.heart.bpm) * scale;
    const isInside = trigger.isMarkerInside(this.session.heart.bpm);
    context.fillStyle = `rgba(76,195,138,${isInside ? 0.28 : 0.14})`;
    context.strokeStyle = isInside ? '#4CC38A' : 'rgba(76,195,138,.6)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (this.session.isBeat) {
      context.strokeStyle = 'rgba(242,178,51,.5)';
      context.beginPath();
      context.arc(center, center, radius * 1.15, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = '#F2B233';
    context.beginPath();
    context.arc(center + trigger.marker.x * scale, center + trigger.marker.y * scale, 9 * scale, 0, Math.PI * 2);
    context.fill();
  }

  private async fire(): Promise<void> {
    this.isFiring = true;
    const outcome = this.session.fire();
    this.finger = null;
    if (!outcome) {
      this.isFiring = false;
      return;
    }
    this.feedback.emit('shot');
    const game = this.game;
    const target = game.target();
    const shotNumber = game.taskShots().length + 1;
    const result = await resolveShot(game.engine, game.scenario(), game.cartridge(), target, outcome.dial, shotNumber, {
      timeS: game.scenarioTimeS(),
      hold: outcome.hold,
    });
    const points = shotPoints(result.missMrad, result.radiusMrad);
    const record: ShotRecord = {
      id: `${Date.now().toString(36)}-${shotNumber}`,
      taskId: game.task().id,
      taskTitle: game.task().title,
      shotNumber,
      firedAtIso: new Date().toISOString(),
      distanceM: target.distanceM,
      scopeId: this.session.scope.id,
      isHit: result.isHit,
      points,
      missMrad: result.missMrad,
      radiusMrad: result.radiusMrad,
      impact: result.impact,
      dial: { upMrad: Math.round(outcome.dial.upMrad * 100) / 100, rightMrad: Math.round(outcome.dial.rightMrad * 100) / 100 },
      ideal: result.ideal,
      hold: result.hold,
      triggerQuality: outcome.triggerQuality,
      hitProbability: result.hitProbability,
      luck: result.luck,
      cause: result.cause,
      verdict: result.verdict,
      timeOfFlightS: result.timeOfFlightS,
    };
    this.marks.unshift(result.impact);
    this.marks.length = Math.min(this.marks.length, MARKS_ON_GLASS);
    this.feedback.scheduleImpact(result.isHit, impactSoundDelayS(result.timeOfFlightS, target.distanceM, game.scenario().atmosphere.temperatureC));
    this.progress.recordShot(record);
    game.addShot(record);
    this.panel.set('bolt');
    this.debriefShot.set(record);
    this.isFiring = false;
  }
}
