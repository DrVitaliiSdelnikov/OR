import { Injectable, signal } from '@angular/core';
import { cartridgeById, CARTRIDGES } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { CartridgeId } from '../../core/types';
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
    void this.buildExampleCardFirst();
  }

  private async buildExampleCardFirst(): Promise<void> {
    const engine = new BallisticsEngine();
    const cards = new Map<CartridgeId, DopeCard>();
    for (const cartridge of [cartridgeById(EXAMPLE_CARTRIDGE_ID), ...CARTRIDGES.filter(other => other.id !== EXAMPLE_CARTRIDGE_ID)]) {
      cards.set(cartridge.id, await buildDopeCard(engine, cartridge, CARD_CLICK_MIL));
      this.built.set(new Map(cards));
    }
  }
}
