import { describe, expect, it } from 'vitest';
import { FreePlayUnlocks } from '../../sim/course';
import { DEFAULT_FREE_PLAY } from '../../sim/free-play';
import { profileFromPreset } from '../../sim/rifle-profile';
import { freePlayView, instructorLineText } from './free-play.model';

const ALL_OPEN: FreePlayUnlocks = {
  unknownDistance: true,
  manualEasy: true,
  manualHard: true,
  cartridgesAC: true,
  gustyWind: true,
  milDotScope: true,
  moaScope: true,
  longRangeScope: true,
  secondFocalPlaneScope: true,
};
const NOTHING_OPEN = Object.fromEntries(Object.keys(ALL_OPEN).map(key => [key, false])) as unknown as FreePlayUnlocks;

describe('free play screen', () => {
  it('a new player: locks with «откроется в упр. N»', () => {
    const view = freePlayView(DEFAULT_FREE_PLAY, NOTHING_OPEN);
    expect(view.unknownLock).toBe('откроется в упр. 05');
    expect(view.winds.find(tile => tile.id === 'gusty')!.lock).toBe('откроется в упр. 09');
    expect(view.winds.filter(tile => tile.lock === null).map(tile => tile.id)).toEqual(['calm', 'light', 'moderate', 'strong']);
    expect(view.modes.map(mode => [mode.id, mode.lock])).toEqual([
      ['auto', null],
      ['manual-easy', 'откроется в упр. 06'],
      ['manual-hard', 'откроется в упр. 10'],
    ]);
    expect(view.cartridges.map(cartridge => [cartridge.id, cartridge.lock])).toEqual([
      ['A', 'откроется в упр. 08'],
      ['B', null],
      ['C', 'откроется в упр. 08'],
    ]);
    expect(view.scopes.map(scope => [scope.id, scope.lock])).toEqual([
      ['course-tree', null],
      ['course-dot', 'откроется в упр. 06'],
      ['moa', 'откроется в упр. 06'],
      ['tree', 'откроется в упр. 09'],
      ['dot', 'откроется в упр. 12'],
    ]);
  });

  it('everything open — no locks', () => {
    const view = freePlayView(DEFAULT_FREE_PLAY, ALL_OPEN);
    expect([view.unknownLock, ...view.winds.map(tile => tile.lock), ...view.modes.map(mode => mode.lock), ...view.cartridges.map(item => item.lock), ...view.scopes.map(item => item.lock)].every(lock => lock === null)).toBe(true);
  });

  it('the chosen values and their texts', () => {
    const view = freePlayView({ ...DEFAULT_FREE_PLAY, distanceM: 650, wind: 'moderate', cartridgeId: 'C', notebookMode: 'manual-easy' }, ALL_OPEN);
    expect(view.distanceText).toBe('650 м');
    expect(view.winds.find(tile => tile.isChosen)!.label).toBe('умеренный');
    expect(view.modes.find(mode => mode.isChosen)!.label).toBe('САМ · лёгкий × 1,5');
    expect(view.cartridgeTile).toBe('Патрон В');
    expect(view.cartridges.find(item => item.id === 'C')!.line).toBe('11,7 г · 775 м/с · BC 0,255');
    expect(view.scopeTile).toBe('Курсовой 3–12× · Ёлка');
  });

  it('unknown distance shows «неизвестная» instead of metres', () => {
    expect(freePlayView({ ...DEFAULT_FREE_PLAY, isDistanceUnknown: true }, ALL_OPEN).distanceText).toBe('неизвестная');
  });
});

describe('the instructor line', () => {
  it('the true correction with arrows', () => {
    expect(instructorLineText({ upMrad: 2.43, rightMrad: -0.61 })).toBe('Расчётные данные: ↑ 2,4 ← 0,6 MIL');
    expect(instructorLineText({ upMrad: 0.8, rightMrad: 0.34 })).toBe('Расчётные данные: ↑ 0,8 → 0,3 MIL');
    expect(instructorLineText({ upMrad: 1.2, rightMrad: 0.01 })).toBe('Расчётные данные: ↑ 1,2 MIL');
  });
});

describe('выбор винтовки (T1.7, В49)', () => {
  const own = profileFromPreset('65-140', 'profile-1', 'Шестёрка');

  it('учебная выбрана, своей нет — «своя» закрыта с подсказкой; прицел и патрон выбираются', () => {
    const view = freePlayView(DEFAULT_FREE_PLAY, ALL_OPEN, null);
    expect(view.rifles).toEqual([
      { id: 'course', label: 'учебная', line: '', lock: null, isChosen: true },
      { id: 'own', label: 'своя', line: '', lock: 'заведи на экране «Винтовка»', isChosen: false },
    ]);
    expect(view.isOwnRifle).toBe(false);
  });

  it('своя выбрана и есть — подпись с именем; прицел и патрон — из профиля', () => {
    const view = freePlayView({ ...DEFAULT_FREE_PLAY, rifle: 'own' }, ALL_OPEN, own);
    expect(view.rifles[1]).toEqual({ id: 'own', label: 'своя · Шестёрка', line: '', lock: null, isChosen: true });
    expect(view.isOwnRifle).toBe(true);
  });

  it('своя выбрана, но профиль удалили — выбрана учебная', () => {
    const view = freePlayView({ ...DEFAULT_FREE_PLAY, rifle: 'own' }, ALL_OPEN, null);
    expect(view.rifles.map(rifle => rifle.isChosen)).toEqual([true, false]);
    expect(view.isOwnRifle).toBe(false);
  });
});

describe('свободная игра в имперских единицах (T1.8a)', () => {
  it('дистанция, патроны, местность и подпись ползунка — ярды, граны, фут/с', () => {
    const view = freePlayView({ ...DEFAULT_FREE_PLAY, distanceM: 300, terrain: 'mountains' }, ALL_OPEN, null, 'imperial');
    expect(view.distanceText).toBe('328 ярдов');
    expect(view.distanceSliderLabel).toBe('Дистанция, ярд');
    expect(view.cartridges[1].line).toBe('168 гранов · 2625 фут/с · BC 0,218');
    expect(view.terrains.find(terrain => terrain.id === 'mountains')!.line).toBe('угол 10–25°, высота 3280–4920 футов, до 766 ярдов');
    expect(view.terrains.find(terrain => terrain.id === 'long-range')!.line).toBe('деривация и Кориолис, 656–1094 ярда');
  });

  it('метрика — как раньше', () => {
    const view = freePlayView({ ...DEFAULT_FREE_PLAY, distanceM: 300, terrain: 'mountains' }, ALL_OPEN, null, 'metric');
    expect(view.distanceText).toBe('300 м');
    expect(view.distanceSliderLabel).toBe('Дистанция, м');
    expect(view.cartridges[1].line).toBe('10,9 г · 800 м/с · BC 0,218');
    expect(view.terrains.find(terrain => terrain.id === 'mountains')!.line).toBe('угол 10–25°, высота 1000–1500 м, до 700 м');
    expect(view.terrains.find(terrain => terrain.id === 'long-range')!.line).toBe('деривация и Кориолис, 600–1000 м');
  });
});
