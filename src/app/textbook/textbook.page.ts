import { Component, computed, ElementRef, inject, signal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ProgressStore } from '../services/progress.store';
import { TermSheetComponent } from './term-sheet.component';
import { TermTile, textbookView } from './textbook.model';

@Component({
  selector: 'or-textbook',
  imports: [IonContent, RouterLink, TermSheetComponent],
  template: `
    <ion-content>
      <div class="textbook" data-test="textbook">
        <header class="header">
          <a class="back" routerLink="/" aria-label="Назад" data-test="textbook-back">←</a>
          <div>
            <h1 class="title">Учебник курсанта</h1>
            <div class="counter mono" data-test="textbook-counter">{{ view().counterText }}</div>
          </div>
        </header>

        <nav class="chapter-chips mono">
          @for (chapter of view().chapters; track chapter.title) {
            <button class="chapter-chip" type="button" (click)="toChapter($index)" [attr.data-test]="'textbook-chip-' + $index">{{ chapter.title }}</button>
          }
        </nav>

        @for (chapter of view().chapters; track chapter.title) {
          <section class="chapter" #chapter [attr.data-test]="'textbook-chapter-' + $index">
            <h2 class="chapter-title">{{ chapter.title }}</h2>
            <div class="tiles">
              @for (tile of chapter.terms; track tile.term) {
                @if (tile.isOpen) {
                  <button class="tile" type="button" (click)="open(tile)" data-test="textbook-term">{{ tile.term }}</button>
                } @else {
                  <div class="tile locked" data-test="textbook-term-locked">
                    <span>{{ tile.term }}</span>
                    <span class="lock mono">{{ tile.lockText }}</span>
                  </div>
                }
              }
            </div>
          </section>
        }
      </div>
    </ion-content>

    @if (openTerm(); as term) {
      <or-term-sheet [openTerm]="term" (close)="openTerm.set(null)" />
    }
  `,
  styles: `
    .textbook { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--gutter) var(--space-6); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .counter { font: 500 var(--type-label) / 18px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .chapter-chips { display: flex; gap: var(--space-1); overflow-x: auto; scrollbar-width: none; }
    .chapter-chip { flex: none; min-height: var(--touch-min); padding: 0 var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text-muted); font: 500 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .chapter { display: flex; flex-direction: column; gap: var(--space-2); scroll-margin-top: var(--space-3); }
    .chapter-title { margin: var(--space-2) 0 0; font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-text-muted); }
    .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
    .tile { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 56px; padding: var(--space-2) var(--space-3); border: 0; border-radius: 6px; background: var(--paper-bg); color: var(--paper-ink); box-shadow: var(--paper-shadow); text-align: left; font: 700 var(--type-label) / 18px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; overflow-wrap: anywhere; }
    .tile.locked { border: 1.5px dashed var(--device-line-strong); background: transparent; color: var(--device-text-muted); box-shadow: none; }
    .lock { font: 500 11px / 14px var(--font-mono); letter-spacing: 0; text-transform: none; }
  `,
})
export class TextbookPage {
  private readonly progress = inject(ProgressStore);
  private readonly chapterSections = viewChildren<ElementRef<HTMLElement>>('chapter');

  protected readonly view = computed(() => textbookView(this.progress.course(), this.progress.settings().isEverythingUnlocked));
  protected readonly openTerm = signal<string | null>(null);

  protected open(tile: TermTile): void {
    this.openTerm.set(tile.term);
  }

  protected toChapter(index: number): void {
    this.chapterSections()[index]?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
