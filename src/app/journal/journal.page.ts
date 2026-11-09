import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { cartridgeById, CARTRIDGES } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { ProgressStore } from '../services/progress.store';
import { achievementsView, cardsView, errorsView, feedView, STATS_MIN_SHOTS, statsView } from './journal.model';

type JournalTab = 'feed' | 'errors' | 'cards' | 'stats' | 'achievements';

const TABS: readonly { id: JournalTab; label: string }[] = [
  { id: 'feed', label: 'Лента' },
  { id: 'errors', label: 'Ошибки' },
  { id: 'cards', label: 'Карточки' },
  { id: 'stats', label: 'Статистика' },
  { id: 'achievements', label: 'Достижения' },
];
const CARD_CLICK_MIL = 0.1;
const PERCENT = 100;

@Component({
  selector: 'or-journal',
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="journal" data-test="journal">
        <header class="header">
          <a class="back" routerLink="/" aria-label="Назад" data-test="journal-back">←</a>
          <h1 class="title">Журнал стрелка</h1>
        </header>

        @if (isEmpty()) {
          <section class="sheet" data-test="journal-empty">
            <p class="empty">Журнал пуст. Первая запись — после упражнения 01</p>
            <a class="to-course" routerLink="/course" data-test="journal-to-course">К курсу</a>
          </section>
        } @else {
          <nav class="tabs mono">
            @for (item of tabs; track item.id) {
              <button class="tab" type="button" [class.active]="tab() === item.id" (click)="tab.set(item.id)" [attr.data-test]="'journal-tab-' + item.id">{{ item.label }}</button>
            }
          </nav>

          @switch (tab()) {
            @case ('feed') {
              @for (item of feed(); track item.id) {
                <button class="sheet series" type="button" (click)="toggle(item.id)" [attr.data-test]="'journal-series-' + $index">
                  <span class="series-head">
                    <span class="series-title">{{ item.title }}</span>
                    @if (item.stamp; as stamp) {
                      <span class="stamp mono" [attr.data-tone]="item.stampTone" data-test="journal-stamp">{{ stamp }}</span>
                    }
                  </span>
                  <span class="meta mono">{{ item.meta }}</span>
                  @if (openSeries() === item.id) {
                    @for (line of item.shots; track $index) {
                      <span class="shot mono" data-test="journal-shot">{{ line }}</span>
                    }
                  }
                </button>
              }
            }
            @case ('errors') {
              <section class="sheet">
                @for (row of errors(); track row.key) {
                  <div class="error-row" [class.top]="row.isTop" data-test="journal-error">
                    <span class="error-label">{{ row.label }}</span>
                    <span class="mono">{{ row.count }} · {{ row.last }}</span>
                  </div>
                } @empty {
                  <p class="empty" data-test="journal-no-errors">Ошибок пока нет</p>
                }
              </section>
            }
            @case ('cards') {
              @for (card of cards(); track card.title) {
                <section class="sheet" [attr.data-test]="'journal-card-' + $index">
                  <div class="card-title">{{ card.title }}</div>
                  @for (row of card.rows; track row.distance) {
                    <div class="card-row mono">
                      <span>{{ row.distance }}</span>
                      <span class="factory">{{ row.factory }}</span>
                      <span class="player" [attr.data-test]="row.player ? 'journal-note-' + row.distance : null">{{ row.player ?? '' }}</span>
                    </div>
                  }
                </section>
              }
            }
            @case ('stats') {
              @if (stats().isEnough) {
                @for (group of statGroups(); track group.title) {
                  <section class="sheet" data-test="journal-stats">
                    <div class="card-title">{{ group.title }}</div>
                    @for (bar of group.bars; track bar.label) {
                      @if (bar.count > 0) {
                        <div class="bar-row mono">
                          <span class="bar-label">{{ bar.label }}</span>
                          <span class="bar"><span class="bar-fill" [style.width.%]="bar.share * percent"></span></span>
                          <span>{{ round(bar.share * percent) }} % · {{ bar.count }}</span>
                        </div>
                      }
                    }
                  </section>
                }
              } @else {
                <section class="sheet"><p class="empty" data-test="journal-stats-few">Статистика наберётся после {{ minShots }} выстрелов</p></section>
              }
            }
            @case ('achievements') {
              <section class="sheet" data-test="journal-achievements">
                <div class="rank">{{ achievements().rank }}</div>
                <div class="mono">{{ achievements().admissions }}</div>
                @for (row of achievements().classes; track row.id) {
                  <div class="error-row">
                    <span>{{ row.id }} · {{ row.title }}</span>
                    <span class="mono">{{ row.stamp ?? '—' }}</span>
                  </div>
                }
                @for (record of achievements().records; track record) {
                  <div class="mono">{{ record }}</div>
                }
              </section>
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .journal { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--gutter) var(--space-6); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .tabs { display: flex; gap: var(--space-1); overflow-x: auto; scrollbar-width: none; }
    .tab { flex: none; min-height: var(--touch-min); padding: 0 var(--space-3); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text-muted); font: 500 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .tab.active { border-color: var(--device-accent); color: var(--device-accent); }
    .sheet { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border: 0; border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); box-shadow: var(--paper-shadow); text-align: left; font: 400 var(--type-body) / 20px var(--font-text); }
    .series-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .series-title, .card-title, .rank { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .meta, .shot { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-graphite); }
    .stamp { --tone: var(--paper-graphite); padding: 0 var(--space-2); border: 2px solid var(--tone); border-radius: 3px; color: var(--tone); font-weight: 700; transform: rotate(-4deg); }
    .stamp[data-tone='gold'] { --tone: var(--paper-stamp-gold); }
    .stamp[data-tone='silver'] { --tone: var(--paper-stamp-silver); }
    .stamp[data-tone='bronze'] { --tone: var(--paper-stamp-bronze); }
    .stamp[data-tone='red'] { --tone: var(--paper-red-pencil); }
    .error-row { display: flex; justify-content: space-between; gap: var(--space-2); }
    .error-row.top .error-label { color: var(--paper-red-pencil); font-weight: 700; }
    .card-row { display: grid; grid-template-columns: 48px 1fr 1fr; font: 500 var(--type-label) / 22px var(--font-mono); }
    .player { color: var(--paper-graphite); }
    .bar-row { display: grid; grid-template-columns: 96px 1fr auto; align-items: center; gap: var(--space-2); font: 500 var(--type-label) / 20px var(--font-mono); }
    .bar { height: 8px; border-radius: 2px; background: var(--paper-grid); }
    .bar-fill { display: block; height: 100%; border-radius: 2px; background: var(--paper-stamp-green); }
    .empty { margin: 0; color: var(--paper-graphite); }
    .to-course { display: grid; place-items: center; min-height: var(--touch-min); border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-body) / 20px var(--font-title); text-transform: uppercase; text-decoration: none; }
  `,
})
export class JournalPage {
  private readonly progress = inject(ProgressStore);
  private readonly dopeCards = signal<DopeCard[]>([]);

  protected readonly tabs = TABS;
  protected readonly percent = PERCENT;
  protected readonly minShots = STATS_MIN_SHOTS;
  protected readonly tab = signal<JournalTab>('feed');
  protected readonly openSeries = signal<string | null>(null);
  protected readonly isEmpty = computed(() => this.progress.journal().length === 0);
  protected readonly feed = computed(() => feedView(this.progress.journal()));
  protected readonly errors = computed(() => errorsView(this.progress.journal()));
  protected readonly stats = computed(() => statsView(this.progress.journal()));
  protected readonly statGroups = computed(() => [
    { title: 'Первым выстрелом · дистанция', bars: this.stats().byDistance },
    { title: 'Ветер', bars: this.stats().byWind },
    { title: 'Режим', bars: this.stats().byMode },
  ]);
  protected readonly cards = computed(() => cardsView(this.dopeCards(), this.progress.dopeNotes()));
  protected readonly achievements = computed(() => achievementsView(this.progress.course()));

  constructor() {
    void this.buildCards();
  }

  protected toggle(seriesId: string): void {
    this.openSeries.update(open => (open === seriesId ? null : seriesId));
  }

  protected round(value: number): number {
    return Math.round(value);
  }

  private async buildCards(): Promise<void> {
    const engine = new BallisticsEngine();
    const cards: DopeCard[] = [];
    for (const cartridge of CARTRIDGES) {
      cards.push(await buildDopeCard(engine, cartridgeById(cartridge.id), CARD_CLICK_MIL));
    }
    this.dopeCards.set(cards);
  }
}
