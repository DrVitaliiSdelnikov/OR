import { Component } from '@angular/core';
import { TargetSchemeComponent } from '../../review/target-scheme.component';
import { GROUP_EXAMPLE_RADIUS_MIL, groupView } from './scheme.model';

@Component({
  selector: 'or-group-scheme',
  imports: [TargetSchemeComponent],
  template: `
    <div class="target" data-test="group-scheme">
      <or-target-scheme [radiusMil]="radiusMil" [groupPoints]="group.impacts" [meanPoint]="group.center" />
    </div>
    <p class="caption mono" data-test="scheme-caption">{{ group.caption }}</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
    .target { width: 100%; max-width: 220px; }
    .caption { margin: 0; align-self: stretch; font: 500 var(--type-label) / 18px var(--font-mono); }
  `,
})
export class GroupSchemeComponent {
  protected readonly radiusMil = GROUP_EXAMPLE_RADIUS_MIL;
  protected readonly group = groupView();
}
