import { Injectable, signal } from '@angular/core';
import { cartridgeById } from '../../core/content';
import { buildDopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { CardsByCartridge } from './terms';

const EXAMPLE_CARTRIDGE_ID = 'B';
const CARD_CLICK_MIL = 0.1;

@Injectable({ providedIn: 'root' })
export class TextbookCards {
  private readonly built = signal<CardsByCartridge | null>(null);
  private isBuilding = false;

  readonly cards = this.built.asReadonly();

  ensureBuilt(): void {
    if (this.isBuilding) {
      return;
    }
    this.isBuilding = true;
    void buildDopeCard(new BallisticsEngine(), cartridgeById(EXAMPLE_CARTRIDGE_ID), CARD_CLICK_MIL).then(card =>
      this.built.set(new Map([[EXAMPLE_CARTRIDGE_ID, card]])),
    );
  }
}
