import { Component, computed, effect, ElementRef, inject, input, output } from '@angular/core';
import { RADIO_CALLSIGN } from './radio.model';
import { TeachingView } from './teaching.model';

interface CutoutFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CUTOUT_PADDING_PX = 6;

@Component({
  selector: 'or-teaching-overlay',
  template: `
    @if (cutout(); as frame) {
      <div class="shade" [style.top.px]="0" [style.left.px]="0" [style.right.px]="0" [style.height.px]="frame.top" data-test="teaching-shade"></div>
      <div class="shade" [style.top.px]="frame.top + frame.height" [style.left.px]="0" [style.right.px]="0" [style.bottom.px]="0" data-test="teaching-shade"></div>
      <div class="shade" [style.top.px]="frame.top" [style.left.px]="0" [style.width.px]="frame.left" [style.height.px]="frame.height" data-test="teaching-shade"></div>
      <div class="shade" [style.top.px]="frame.top" [style.left.px]="frame.left + frame.width" [style.right.px]="0" [style.height.px]="frame.height" data-test="teaching-shade"></div>
      <div class="frame" [style.top.px]="frame.top" [style.left.px]="frame.left" [style.width.px]="frame.width" [style.height.px]="frame.height" data-test="teaching-cutout"></div>
      <div class="hint-card" [class.above]="isCardAbove()" [style.top.px]="isCardAbove() ? null : frame.top + frame.height + 12" [style.bottom.px]="isCardAbove() ? viewportHeight() - frame.top + 12 : null" data-test="teaching-card">
        <div class="hint-head mono">
          <span>{{ callsign }}</span>
          @if (view().number !== null) {
            <span data-test="teaching-count">подсказка {{ view().number }} из {{ view().count }}</span>
          }
        </div>
        <div class="hint-text" data-test="teaching-text">{{ view().text }}</div>
        <div class="hint-actions">
          @if (view().kind === 'explain') {
            <button class="understood" type="button" (click)="acknowledge.emit()" data-test="teaching-ok">Понял</button>
          }
          @if (view().number !== null) {
            <button class="skip mono" type="button" (click)="skip.emit()" data-test="teaching-skip">пропустить обучение</button>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
    .shade, .hint-card { position: fixed; pointer-events: auto; }
    .shade { background: rgba(6, 8, 5, 0.72); }
    .frame { position: fixed; border: 2px solid var(--device-accent); border-radius: var(--radius-device); pointer-events: none; }
    .hint-card { left: var(--gutter); right: var(--gutter); padding: var(--space-3); border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); box-shadow: var(--paper-shadow); animation: appear var(--motion-hint) ease-out; }
    .hint-head { display: flex; justify-content: space-between; color: var(--paper-graphite); font: 500 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .hint-text { margin-top: var(--space-2); font: 700 var(--type-value) / 22px var(--font-title); }
    .hint-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-3); }
    .hint-actions:empty { display: none; }
    .understood { min-height: var(--touch-min); padding: 0 var(--space-4); border: none; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .skip { margin-left: auto; min-height: var(--touch-min); padding: 0; border: none; background: none; color: var(--paper-graphite); font: 500 var(--type-min) / 16px var(--font-mono); text-decoration: underline; }
    @keyframes appear { from { opacity: 0; } }
  `,
})
export class TeachingOverlayComponent {
  readonly view = input.required<TeachingView>();
  readonly revision = input(0);
  readonly acknowledge = output<void>();
  readonly skip = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly callsign = RADIO_CALLSIGN;
  protected readonly viewportHeight = computed(() => {
    this.revision();
    return this.host.nativeElement.getBoundingClientRect().height;
  });
  private scrolledHintId: string | null = null;
  private readonly bringAnchorIntoView = effect(() => {
    this.revision();
    const view = this.view();
    const anchor = document.querySelector(`[data-hint="${view.anchor}"]`);
    if (anchor && view.id !== this.scrolledHintId) {
      this.scrolledHintId = view.id;
      anchor.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
  protected readonly cutout = computed<CutoutFrame | null>(() => {
    this.revision();
    const anchor = document.querySelector(`[data-hint="${this.view().anchor}"]`);
    if (!anchor) {
      return null;
    }
    const rect = anchor.getBoundingClientRect();
    // `position: fixed` внутри `ion-page` (contain: layout) отсчитывается от страницы, а не от окна.
    const origin = this.host.nativeElement.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }
    return {
      top: Math.max(0, rect.top - origin.top - CUTOUT_PADDING_PX),
      left: Math.max(0, rect.left - origin.left - CUTOUT_PADDING_PX),
      width: rect.width + CUTOUT_PADDING_PX * 2,
      height: rect.height + CUTOUT_PADDING_PX * 2,
    };
  });
  protected readonly isCardAbove = computed(() => {
    const frame = this.cutout();
    return frame !== null && frame.top + frame.height / 2 > this.viewportHeight() / 2;
  });
}
