import { describe, expect, it } from 'vitest';
import { ProfileDopeCard } from '../../sim/profile-dope';
import { dopeTableView, exportFileName } from './dope-print.model';

function card(fields: Partial<ProfileDopeCard['header']> = {}, distanceUnit: ProfileDopeCard['distanceUnit'] = 'metric'): ProfileDopeCard {
  return {
    distanceUnit,
    header: { profileName: 'Моя .308', zero: 100, temperature: 15, pressure: 1013, scopeUnits: 'MIL', clickValue: 0.1, zeroAngle: 2.3, windUnit: 'mps', ...fields },
    rows: [
      { distance: 50, elevation: 0.1, clicks: 1, windPerUnit: 0, spinDriftRight: 0, timeOfFlightS: 0.06 },
      { distance: 100, elevation: 0, clicks: 0, windPerUnit: 0.1, spinDriftRight: 0, timeOfFlightS: 0.13 },
      { distance: 600, elevation: -5.7, clicks: -57, windPerUnit: 0.5, spinDriftRight: 0.2, timeOfFlightS: 1.01 },
      { distance: 650, elevation: 6.4, clicks: 64, windPerUnit: 0.6, spinDriftRight: -0.3, timeOfFlightS: 1.12 },
    ],
  };
}

describe('таблица карточки для экрана, печати и картинки', () => {
  it('метрика, MIL: шапка, колонки и строки со стрелками', () => {
    const view = dopeTableView(card());
    expect(view.title).toBe('ДОПЕ · Моя .308');
    expect(view.headerLines).toEqual(['ноль 100 м · +15 °C · 1013 гПа', 'прицел MIL · клик 0,1 · Z 2,30']);
    expect(view.columns).toEqual(['м', 'ВЕРТ', 'кл.', 'ВЕТЕР 1 м/с', 'ДЕР', 'с']);
    expect(view.rows.slice(1)).toEqual([
      ['100', '0,0', '0', '0,1', '0,0', '0,13'],
      ['600', '↓ 5,7', '−57', '0,5', '→ 0,2', '1,01'],
      ['650', '↑ 6,4', '64', '0,6', '← 0,3', '1,12'],
    ]);
  });

  it('имперская, MOA: ярды, °F, inHg, ветер 1 mph, MOA с четвертями', () => {
    const view = dopeTableView({
      ...card({ zero: 109, temperature: 59, pressure: 29.91, scopeUnits: 'MOA', clickValue: 0.25, zeroAngle: 7.9, windUnit: 'mph' }, 'imperial'),
      rows: [{ distance: 600, elevation: 18.25, clicks: 73, windPerUnit: 0.75, spinDriftRight: 0.5, timeOfFlightS: 0.9 }],
    });
    expect(view.headerLines).toEqual(['ноль 109 ярдов · +59 °F · 29,91 дюйма рт. ст.', 'прицел MOA · клик 0,25 · Z 7,90']);
    expect(view.columns).toEqual(['ярд', 'ВЕРТ', 'кл.', 'ВЕТЕР 1 миль/ч', 'ДЕР', 'с']);
    expect(view.rows).toEqual([['600', '↑ 18,25', '73', '0,75', '→ 0,50', '0,90']]);
  });

  it('имя файла картинки: без запрещённых символов и пробелов', () => {
    expect(exportFileName('Моя .308 / тест?')).toBe('dope-Моя-.308-тест.png');
    expect(exportFileName('   ')).toBe('dope.png');
  });
});
