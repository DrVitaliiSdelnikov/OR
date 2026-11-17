import { Component, input } from '@angular/core';
import { PencilNote } from './pencil.model';

@Component({
  selector: 'or-pencil-note',
  template: `<s class="player">{{ note().player }}</s>{{ ' ' }}<span class="needed">{{ note().needed }}</span>`,
  styles: `
    :host { display: block; font: 700 12px / 16px var(--font-mono); color: var(--paper-red-pencil); }
    .player { font-weight: 500; color: var(--paper-graphite); text-decoration-color: var(--paper-red-pencil); }
  `,
})
export class PencilNoteComponent {
  readonly note = input.required<PencilNote>();
}
