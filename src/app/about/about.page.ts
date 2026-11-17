import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import packageJson from '../../../package.json';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';

@Component({
  selector: 'or-about',
  imports: [BackLinkDirective, IonContent],
  template: `
    <ion-content>
      <div class="about" data-test="about">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="about-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>
        <p class="subtitle">{{ texts.subtitle }}</p>

        <ol class="points">
          @for (point of texts.points; track point.title) {
            <li class="point" data-test="about-point">
              <h2 class="point-title">{{ point.title }}</h2>
              <p class="point-text">{{ point.text }}</p>
            </li>
          }
        </ol>

        <section class="group" data-test="about-plans">
          <h2 class="label mono">{{ texts.plansTitle }}</h2>
          <ul class="plans">
            @for (plan of texts.plans; track plan) {
              <li class="plan" data-test="about-plan">{{ plan }}</li>
            }
          </ul>
        </section>

        <section class="group" data-test="about-licenses">
          <h2 class="label mono">{{ texts.licensesTitle }}</h2>
          @for (item of texts.licenses; track item.name) {
            <div class="license mono">{{ item.name }} · {{ item.license }}</div>
          }
        </section>

        <div class="version mono" data-test="about-version">{{ texts.version({ version: version }) }}</div>
      </div>
    </ion-content>
  `,
  styles: `
    .about { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle { margin: 0; font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .points { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; list-style: none; counter-reset: point; }
    .point { counter-increment: point; padding-left: var(--space-6); position: relative; }
    .point::before { content: counter(point, decimal-leading-zero); position: absolute; left: 0; top: 2px; font: 700 var(--type-label) / 16px var(--font-mono); color: var(--device-accent); }
    .point-title { margin: 0 0 var(--space-1); font: 700 var(--type-value) / 1.25 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-text); }
    .point-text { margin: 0; font: 400 var(--type-body) / 1.45 var(--font-text); color: var(--device-text); }
    .group { display: flex; flex-direction: column; gap: var(--space-1); }
    .label { margin: 0 0 var(--space-1); font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .plans { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding-left: var(--space-4); font: 400 var(--type-body) / 1.45 var(--font-text); color: var(--device-text); }
    .license, .version { font: 500 var(--type-label) / 1.4 var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class AboutPage {
  protected readonly texts = text.about;
  protected readonly version = packageJson.version;
}
