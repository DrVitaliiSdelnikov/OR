import { Component, input } from '@angular/core';
import { DopeTableRow } from './notebook.model';

@Component({
  selector: 'or-dope-tab',
  template: `
    <div class="heading mono" data-test="dope-heading">{{ heading() }}</div>
    <div class="scroller" data-test="dope-scroller">
      <table class="table mono">
        <thead>
          <tr>
            <th class="pinned">Дист</th>
            <th>Верт</th>
            <th>Кл.</th>
            <th>t</th>
            <th title="константа ветра">K</th>
            <th title="холоднее на 10 °C">−10 °C</th>
            <th title="давление +10 гПа">+10 гПа</th>
            <th title="мои заметки">Заметки</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.distanceM) {
            <tr [class.current]="row.isCurrent" [attr.data-test]="row.isCurrent ? 'dope-current' : null">
              <td class="pinned">{{ row.distanceM }}</td>
              <td>{{ row.elevation }}</td>
              <td>{{ row.clicks }}</td>
              <td>{{ row.timeOfFlight }}</td>
              <td>{{ row.windConstant }}</td>
              <td>{{ row.colderBy10C }}</td>
              <td>{{ row.pressureUp10Hpa }}</td>
              <td class="notes">—</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .heading { margin-bottom: var(--space-2); font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-ink); }
    .scroller { overflow-x: auto; }
    .table { border-collapse: separate; border-spacing: 0; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-ink); white-space: nowrap; }
    th { padding: 4px 8px; text-align: right; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid var(--paper-ink); }
    td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--paper-grid); }
    .pinned { position: sticky; left: 0; z-index: 1; text-align: left; background: var(--paper-bg); }
    .notes { color: var(--paper-graphite); }
    tr.current td { font-weight: 700; }
    tr.current td.pinned { outline: 2px solid var(--paper-graphite); outline-offset: -2px; border-radius: 10px; }
  `,
})
export class DopeTabComponent {
  readonly heading = input.required<string>();
  readonly rows = input.required<DopeTableRow[]>();
}
