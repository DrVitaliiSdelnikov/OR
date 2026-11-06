import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { RIFLE } from '../../core/content';
import { densityAltitudeM, formatClock } from '../../core/field';
import { FREE_TASK, isTaskUnlocked, maxScore, ShootTask, TaskDef, TASKS } from '../../sim/tasks';
import { GameSession } from '../services/game-session';
import { ProgressStore } from '../services/progress.store';

@Component({
  selector: 'or-hub',
  imports: [IonContent, IonIcon, RouterLink],
  templateUrl: './hub.page.html',
  styleUrl: './hub.page.scss',
})
export class HubPage {
  private readonly router = inject(Router);
  protected readonly session = inject(GameSession);
  protected readonly progress = inject(ProgressStore);
  protected readonly tasks = TASKS;
  protected readonly zeroM = RIFLE.zeroM;
  protected readonly isTaskListOpen = signal(false);

  protected readonly passedCount = computed(() => this.progress.passedTaskIds().size);
  protected readonly densityAltitude = computed(() => {
    const snapshot = this.session.gaugeSnapshot();
    return snapshot ? Math.round(densityAltitudeM(snapshot.temperatureC, snapshot.pressureHpa)) : null;
  });
  protected readonly snapshotTime = computed(() => {
    const snapshot = this.session.gaugeSnapshot();
    return snapshot ? new Date(snapshot.takenAtIso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;
  });
  protected readonly gaugeClock = computed(() => {
    const snapshot = this.session.gaugeSnapshot();
    return snapshot ? formatClock(snapshot.windClock) : '';
  });

  constructor() {
    addIcons({ settingsOutline });
  }

  protected stars(taskId: string): string {
    const stars = this.progress.results()[taskId]?.stars ?? 0;
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  protected isUnlocked(task: TaskDef): boolean {
    return isTaskUnlocked(task, this.progress.passedTaskIds(), this.progress.settings().isEverythingUnlocked);
  }

  protected maxScoreOf(task: TaskDef): number {
    return maxScore(task);
  }

  protected isActive(task: TaskDef): boolean {
    return this.session.task().id === task.id;
  }

  protected openTask(task: TaskDef): void {
    if (!this.isUnlocked(task)) {
      return;
    }
    if (task.kind === 'quiz') {
      void this.router.navigate(['/tabs/hub/tasks', task.id]);
      return;
    }
    this.session.startTask(task as ShootTask);
    void this.router.navigate(['/tabs/hub/weather']);
  }

  protected startFreeMode(): void {
    this.session.startTask(FREE_TASK);
    void this.router.navigate(['/tabs/hub/weather']);
  }
}
