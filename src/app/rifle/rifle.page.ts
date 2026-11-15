import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { PROFILE_PRESETS } from '../../sim/rifle-profile';
import { BackLinkDirective } from '../services/back-link.directive';
import { backLayer } from '../services/back-stack.service';
import { ProgressStore } from '../services/progress.store';
import { IS_PRO_UNLOCKED, OwnRifleRow, rifleListView } from './rifle.model';

@Component({
  selector: 'or-rifle',
  imports: [BackLinkDirective, IonContent],
  template: `
    @let view = list();
    <ion-content>
      <div class="page" data-test="rifle-page">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="rifle-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>

        <section class="sheet paper">
          <div class="row" data-test="rifle-course">
            <div class="row-text">
              <div class="name">{{ view.course.name }}</div>
              <div class="line mono">{{ view.course.line }}</div>
            </div>
            @if (view.course.isActive) {
              <span class="stamp mono" data-test="rifle-course-active">{{ texts.active }}</span>
            } @else {
              <button class="action" type="button" (click)="progress.setActiveProfile(null)" data-test="rifle-course-make-active">{{ texts.makeActive }}</button>
            }
          </div>

          @for (row of view.own; track row.id) {
            <div class="row own" [attr.data-test]="'rifle-row-' + row.id">
              <div class="row-text">
                <div class="name" data-test="rifle-name">{{ row.name }}</div>
                <div class="line mono" data-test="rifle-line">{{ row.line }}</div>
              </div>
              @if (row.isActive) {
                <span class="stamp mono" data-test="rifle-active">{{ texts.active }}</span>
              }
              <div class="actions">
                @if (!row.isActive) {
                  <button class="action" type="button" (click)="progress.setActiveProfile(row.id)" data-test="rifle-make-active">{{ texts.makeActive }}</button>
                }
                <button class="action" type="button" (click)="open(row, 'dope')" data-test="rifle-dope">{{ texts.dope }}</button>
                <button class="action" type="button" (click)="open(row, 'edit')" data-test="rifle-edit">{{ texts.edit }}</button>
                <button class="action danger" type="button" (click)="removing.set(row)" data-test="rifle-remove">{{ texts.remove }}</button>
              </div>
            </div>
          }
        </section>

        @if (view.canAdd) {
          @if (isChoosingPreset()) {
            <section class="sheet paper" data-test="rifle-presets">
              <h2 class="label mono">{{ texts.presetsTitle }}</h2>
              @for (preset of presets; track preset.code) {
                <button class="preset" type="button" (click)="startFromPreset(preset.code)" [attr.data-test]="'rifle-preset-' + preset.code">{{ preset.name }}</button>
              }
              <button class="action" type="button" (click)="isChoosingPreset.set(false)" data-test="rifle-presets-cancel">{{ texts.cancel }}</button>
            </section>
          } @else {
            <button class="add" type="button" (click)="isChoosingPreset.set(true)" data-test="rifle-add">{{ texts.add }}</button>
          }
        } @else {
          <div class="pro mono" data-test="rifle-pro">{{ texts.proOnly }}</div>
        }
      </div>

      @if (removing(); as row) {
        <div class="confirm" role="alertdialog" data-test="rifle-remove-confirm">
          <div>{{ texts.removeQuestion({ name: row.name }) }}</div>
          <div class="confirm-actions">
            <button class="confirm-yes" type="button" (click)="remove(row)" data-test="rifle-remove-yes">{{ texts.removeYes }}</button>
            <button class="confirm-no" type="button" (click)="removing.set(null)" data-test="rifle-remove-cancel">{{ texts.cancel }}</button>
          </div>
        </div>
      }
    </ion-content>
  `,
  styleUrl: './rifle.styles.css',
})
export class RiflePage {
  protected readonly progress = inject(ProgressStore);
  private readonly router = inject(Router);
  protected readonly texts = text.rifle;
  protected readonly presets = PROFILE_PRESETS;
  protected readonly isChoosingPreset = signal(false);
  protected readonly removing = signal<OwnRifleRow | null>(null);
  protected readonly list = computed(() =>
    rifleListView(this.progress.profiles(), this.progress.activeProfileId(), this.progress.settings().unitSystem, IS_PRO_UNLOCKED),
  );
  private readonly removeConfirmLayer = backLayer(() => this.removing() !== null, () => this.removing.set(null));
  private readonly presetsLayer = backLayer(() => this.isChoosingPreset(), () => this.isChoosingPreset.set(false));

  protected open(row: OwnRifleRow, target: 'dope' | 'edit'): void {
    void this.router.navigate(target === 'dope' ? ['/rifle', row.id, 'dope'] : ['/rifle', row.id]);
  }

  protected startFromPreset(presetCode: string): void {
    void this.router.navigate(['/rifle', 'new', presetCode]);
  }

  protected remove(row: OwnRifleRow): void {
    this.progress.removeProfile(row.id);
    this.removing.set(null);
  }
}
