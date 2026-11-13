import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { RANK_LABELS, rankHeader } from '../home/home.model';
import { ProgressStore } from '../services/progress.store';
import { ClassStamp, STAMP_CLASSES, TrailNode, trailNodes } from './course-trail.model';
import { BackLinkDirective } from '../services/back-link.directive';

@Component({
  selector: 'or-course-trail',
  imports: [BackLinkDirective, IonContent],
  template: `
    <ion-content>
      <div class="trail-screen">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="trail-back">←</a>
          <div>
            <h1>{{ texts.title }}</h1>
            <div class="meta" data-test="trail-progress">{{ texts.progress({ admissions: header().admissions, admissionsTotal: header().admissionsTotal, rank: header().rankLabel }) }}</div>
          </div>
        </header>

        <ol class="trail">
          @for (node of nodes(); track node.id) {
            <li class="step">
              <button
                class="node"
                type="button"
                [class]="'node ' + node.state"
                [disabled]="node.state === 'locked'"
                [attr.data-state]="node.state"
                [attr.data-test]="'node-' + node.id"
                (click)="open(node)"
              >
                <span class="number">{{ node.id }}</span>
                <span class="name">{{ node.title }}</span>
                @if (node.state === 'locked') {
                  <span class="badge" [attr.aria-label]="texts.locked">🔒</span>
                } @else if (node.isIntro && node.state === 'passed') {
                  <span class="badge">{{ texts.passed }}</span>
                } @else if (node.stamp) {
                  <span class="stamp" [class]="'stamp ' + node.stamp" [attr.data-test]="'stamp-' + node.id">{{ stampLabel(node.stamp) }}</span>
                }
                @if (node.isAttestation) {
                  <span class="attestation">{{ attestationLine }}</span>
                }
              </button>
            </li>
          }
        </ol>
      </div>
    </ion-content>
  `,
  styles: `
    .trail-screen { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--gutter) var(--space-6); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    h1 { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .meta { font: 500 var(--type-label) / 18px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .trail { list-style: none; margin: 0; padding: 0 0 0 var(--space-3); border-left: 2px solid var(--device-line-strong); display: flex; flex-direction: column; gap: var(--space-2); }
    .node { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: var(--space-2); width: 100%; min-height: var(--button-main-height); padding: var(--space-2) var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); text-align: left; cursor: pointer; }
    .node.locked { border-style: dashed; border-color: var(--device-line-muted); background: transparent; color: var(--device-text-muted); cursor: default; }
    .node.current { border-color: var(--device-accent); box-shadow: 0 0 0 1px var(--device-accent); animation: pulse 1.6s ease-in-out infinite; }
    .number { font: 700 var(--type-label) / 16px var(--font-mono); color: var(--device-accent); }
    .name { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .badge, .attestation { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
    .attestation { grid-column: 2 / 4; color: var(--device-accent); }
    .stamp { padding: 2px var(--space-2); border: 2px solid currentColor; border-radius: var(--radius-device); font: 700 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; }
    .stamp.gold { color: var(--device-accent); }
    .stamp.silver { color: var(--device-text); }
    .stamp.bronze { color: var(--device-text-muted); }
    @keyframes pulse { 50% { box-shadow: 0 0 0 4px rgba(200, 162, 74, 0.25); } }
    @media (prefers-reduced-motion: reduce) { .node.current { animation: none; } }
  `,
})
export class CourseTrailPage {
  private readonly progress = inject(ProgressStore);
  private readonly router = inject(Router);

  protected readonly texts = text.screens.courseTrail;
  protected readonly attestationLine = this.texts.attestation({ rank: RANK_LABELS.sniper });
  protected readonly header = computed(() => rankHeader(this.progress.course()));
  protected readonly nodes = computed(() => trailNodes(this.progress.course(), this.progress.settings().isEverythingUnlocked));

  protected stampLabel(stamp: ClassStamp): string {
    return this.texts.stamp({ exerciseClass: STAMP_CLASSES[stamp] });
  }

  protected open(node: TrailNode): void {
    if (node.state === 'locked') {
      return;
    }
    void this.router.navigate(['/course', node.id]);
  }
}
