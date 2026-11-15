import { fromInput } from '../../core/units';
import { text } from '../../i18n';
import { decimal, signed } from '../../i18n/format';
import { ProfileDopeCard } from '../../sim/profile-dope';
import { ScopeUnits } from '../../sim/scope-model';

export interface DopeTableView {
  title: string;
  headerLines: string[];
  columns: string[];
  rows: string[][];
}

const T = text.rifle.card;
const UNITS = text.units;
const SCOPE_DIGITS: Record<ScopeUnits, number> = { MIL: 1, MOA: 2 };
const TIME_DIGITS = 2;
const FORBIDDEN_FILE_CHARACTERS = /[\\/:*?"<>|]/g;
const SPACES = /\s+/g;
const REPEATED_DASHES = /-+/g;
const EDGE_DASHES = /^-|-$/g;

export function dopeTableView(card: ProfileDopeCard): DopeTableView {
  const { header, distanceUnit: system } = card;
  const digits = SCOPE_DIGITS[header.scopeUnits];
  const scopeValue = (value: number): string => decimal(Math.abs(value), digits);
  const withArrow = (value: number, positive: string, negative: string): string => (value === 0 ? scopeValue(0) : `${value > 0 ? positive : negative} ${scopeValue(value)}`);
  return {
    title: T.title({ name: header.profileName }),
    headerLines: [
      T.conditions({
        zero: UNITS.quantityText('distance', fromInput('distance', header.zero, system), system),
        temperature: `${signed(header.temperature)} ${UNITS.unitLabel('temperature', system)}`,
        pressure: UNITS.quantityText('pressure', fromInput('pressure', header.pressure, system), system),
      }),
      T.scope({ units: header.scopeUnits, clickValue: header.clickValue, zeroAngle: header.zeroAngle }),
    ],
    columns: [
      UNITS.unitLabel('distance', system),
      T.columns.elevation,
      T.columns.clicks,
      T.columns.wind({ unit: UNITS.unitLabel('windSpeed', system) }),
      T.columns.spinDrift,
      T.columns.time,
    ],
    rows: card.rows.map(row => [
      String(row.distance),
      withArrow(row.elevation, '↑', '↓'),
      decimal(row.clicks),
      scopeValue(row.windPerUnit),
      withArrow(row.spinDriftRight, '→', '←'),
      decimal(row.timeOfFlightS, TIME_DIGITS),
    ]),
  };
}

export function exportFileName(profileName: string): string {
  const safeName = profileName.replace(FORBIDDEN_FILE_CHARACTERS, ' ').trim().replace(SPACES, '-').replace(REPEATED_DASHES, '-').replace(EDGE_DASHES, '');
  return safeName ? `${T.imageFileFallback}-${safeName}.png` : `${T.imageFileFallback}.png`;
}
