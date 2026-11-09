import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { Correction } from '../../core/types';
import { groupText } from '../review/review.model';
import { TargetSchemeComponent } from '../review/target-scheme.component';
import { FeedbackService } from '../services/feedback.service';
import { TermSheetService } from '../textbook/term-sheet.service';
import { ResultSheetView } from './result.model';

@Component({
  selector: 'or-result-sheet',
  imports: [TargetSchemeComponent],
  template: `
    @let sheet = view();
    <section class="result" role="dialog" aria-label="Итог упражнения" data-test="result-sheet">
      <div class="body">
        <header class="head">
          <div class="title">Итог упражнения</div>
          <div class="stamps">
            @if (sheet.struckClass; as struck) {
              <span class="struck mono" data-test="result-struck">{{ struck }}</span>
            }
            <span [class]="'stamp tone-' + sheet.stampTone" data-test="result-stamp">{{ sheet.stamp }}</span>
          </div>
          @if (sheet.rankPlate; as rank) {
            <div class="rank mono" data-test="result-rank">{{ rank }}</div>
          }
        </header>

        <ul class="class-rows">
          @for (row of sheet.classRows; track row.label) {
            <li class="class-row" [class.met]="row.isMet" [attr.data-test]="'result-class-' + $index">
              <span [class]="'marker class-' + (3 - $index)"></span>
              <span class="row-label mono">{{ row.label }}</span>
              <span class="row-text">{{ row.text }}</span>
              <span class="mark mono">{{ row.isMet ? '✓' : '✕' }}</span>
            </li>
          }
        </ul>

        <div class="score mono" data-test="result-score">{{ sheet.scoreLine }}</div>
        <div class="record mono" data-test="result-record">{{ sheet.recordLine }}</div>

        <div class="series">
          <or-target-scheme [radiusMil]="radiusMil()" [groupPoints]="group()" [callPoints]="calls()" />
          <div class="series-text mono" data-test="result-group">{{ groupLine() }}</div>
        </div>

        <div class="main-error" [class.clean]="sheet.mainError === 'Ошибок нет'" data-test="result-main-error">{{ sheet.mainError }}</div>

        @if (sheet.newTerms.length > 0 || sheet.openedLine) {
          <div class="news" data-test="result-news">
            @if (sheet.newTerms.length > 0) {
              <div class="terms-label mono">новые термины</div>
              <div class="terms">
                @for (term of sheet.newTerms; track term) {
                  <button class="term mono" type="button" [style.animation-delay.ms]="$index * 250" (click)="termSheet.open(term)" data-test="result-term">{{ term }}</button>
                }
              </div>
            }
            @if (sheet.openedLine; as opened) {
              <div class="opened mono" data-test="result-opened">{{ opened }}</div>
            }
          </div>
        }
      </div>

      <footer class="foot">
        @if (sheet.isAdmitted) {
          <button class="main mono" type="button" (click)="next.emit()" data-test="result-next">Дальше</button>
          <button class="secondary mono" type="button" (click)="repeat.emit()" data-test="result-repeat">Повторить</button>
        } @else {
          <button class="main mono" type="button" (click)="repeat.emit()" data-test="result-repeat">Повторить</button>
        }
        <button class="secondary mono" type="button" (click)="journal.emit()" data-test="result-journal">В журнал</button>
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .result { display: flex; flex-direction: column; height: 100%; background: var(--device-surface); }
    .body { display: flex; flex: 1; flex-direction: column; gap: var(--space-3); min-height: 0; overflow-y: auto; padding: var(--space-3) var(--gutter); background: var(--paper-bg); color: var(--paper-ink); }
    .head { display: flex; flex-direction: column; gap: var(--space-2); }
    .title { font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--paper-graphite); }
    .stamps { display: flex; align-items: center; gap: var(--space-3); min-height: 64px; }
    .stamp { padding: 6px 14px; border: 3px solid currentColor; border-radius: 4px; font: 700 28px / 36px var(--font-title); letter-spacing: var(--tracking-title); transform: rotate(-5deg); animation: stamp-hit 0.35s ease-out both; }
    .tone-gold { color: var(--paper-stamp-gold); }
    .tone-silver { color: var(--paper-stamp-silver); }
    .tone-bronze { color: var(--paper-stamp-bronze); }
    .tone-red { color: var(--paper-red-pencil); }
    .struck { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-graphite); text-decoration: line-through; }
    .rank { align-self: flex-start; padding: 4px 10px; border: 1.5px solid var(--paper-ink); border-radius: var(--radius-paper); font: 700 var(--type-label) / 18px var(--font-mono); }
    .class-rows { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .class-row { display: grid; grid-template-columns: 6px 64px minmax(0, 1fr) 20px; gap: var(--space-2); align-items: start; font: 500 12px / 16px var(--font-mono); color: var(--paper-graphite); }
    .class-row.met { color: var(--paper-ink); }
    .marker { align-self: stretch; border-radius: 2px; }
    .class-1 { background: var(--paper-stamp-gold); }
    .class-2 { background: var(--paper-stamp-silver); }
    .class-3 { background: var(--paper-stamp-bronze); }
    .row-label { font-weight: 700; }
    .mark { font-weight: 700; text-align: right; }
    .score { font: 700 var(--type-label) / 18px var(--font-mono); }
    .record { margin-top: -8px; font: 500 12px / 16px var(--font-mono); color: var(--paper-graphite); }
    .series { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2); align-items: center; }
    .series-text { font: 700 var(--type-label) / 18px var(--font-mono); }
    .main-error { padding-left: var(--space-2); border-left: 2px solid var(--paper-red-pencil); font: 700 var(--type-label) / 18px var(--font-mono); color: var(--paper-red-pencil); }
    .main-error.clean { border-color: var(--paper-ink); color: var(--paper-ink); }
    .news { display: flex; flex-direction: column; gap: 4px; }
    .terms-label { font: 500 12px / 16px var(--font-mono); color: var(--paper-graphite); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .terms { display: flex; flex-wrap: wrap; gap: 6px; }
    .term { min-height: var(--touch-min); padding: 0 var(--space-3); border: 1.5px solid var(--paper-ink); border-radius: var(--radius-paper); background: transparent; color: var(--paper-ink); font: 500 12px / 16px var(--font-mono); animation: term-in 0.3s ease-out both; }
    .opened { margin-top: 4px; font: 700 var(--type-label) / 18px var(--font-mono); }
    .foot { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: var(--space-2); padding: var(--space-2) var(--gutter) var(--space-3); }
    .foot:has(> :nth-child(2):last-child) { grid-template-columns: 1.4fr 1fr; }
    .main, .secondary { min-height: 52px; border-radius: var(--radius-device); font: 700 12px / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .main { border: none; background: var(--device-accent); color: var(--device-on-accent); }
    .secondary { border: 1px solid var(--device-line-strong); background: transparent; color: var(--device-text); }
    @keyframes stamp-hit { from { opacity: 0; transform: rotate(-5deg) scale(1.6); } to { opacity: 1; transform: rotate(-5deg) scale(1); } }
    @keyframes term-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  `,
})
export class ResultSheetComponent implements OnInit {
  readonly view = input.required<ResultSheetView>();
  readonly group = input.required<readonly Correction[]>();
  readonly calls = input.required<readonly Correction[]>();
  readonly radiusMil = input.required<number>();
  readonly next = output<void>();
  readonly repeat = output<void>();
  readonly journal = output<void>();

  private readonly feedback = inject(FeedbackService);
  protected readonly termSheet = inject(TermSheetService);
  protected readonly groupLine = computed(() => groupText(this.group()));

  ngOnInit(): void {
    this.feedback.emit('stamp');
  }
}
