import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { cartridgeById, CARTRIDGES, courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { CartridgeId } from '../../core/types';
import { UnitSystem } from '../../core/units';
import { CardsByCartridge } from './terms';

const EXAMPLE_CARTRIDGE_ID = 'B';
const CARD_CLICK_MIL = 0.1;

@Injectable({ providedIn: 'root' })
export class TextbookCards {
  private readonly built: Record<UnitSystem, WritableSignal<CardsByCartridge | null>> = { metric: signal(null), imperial: signal(null) };
  private readonly buildingSystems = new Set<UnitSystem>();

  cardsIn(system: UnitSystem): Signal<CardsByCartridge | null> {
    return this.built[system];
  }

  ensureBuilt(system: UnitSystem = 'metric'): void {
    if (this.buildingSystems.has(system)) {
      return;
    }
    this.buildingSystems.add(system);
    void this.buildExampleCardFirst(system);
  }

  private async buildExampleCardFirst(system: UnitSystem): Promise<void> {
    const engine = new BallisticsEngine();
    const cards = new Map<CartridgeId, DopeCard>();
    for (const cartridge of [cartridgeById(EXAMPLE_CARTRIDGE_ID), ...CARTRIDGES.filter(other => other.id !== EXAMPLE_CARTRIDGE_ID)]) {
      cards.set(cartridge.id, await buildDopeCard(engine, courseLoadout(cartridge.id, system), CARD_CLICK_MIL, system));
      this.built[system].set(new Map(cards));
    }
  }
}
