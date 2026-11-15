import { describe, expect, it } from 'vitest';
import { profileFromPreset } from '../../sim/rifle-profile';
import { rifleListView } from './rifle.model';

const own308 = profileFromPreset('308-175', 'profile-1', 'Моя .308');
const own65 = profileFromPreset('65-140', 'profile-2', 'Шестёрка');

describe('список винтовок', () => {
  it('без своих: учебная сверху и активна; добавить можно', () => {
    const view = rifleListView([], null, 'metric', true);
    expect(view.course).toEqual({ name: '«Рубеж-1», класс .308', line: 'патрон Б · ноль 100 м', isActive: true });
    expect(view.own).toEqual([]);
    expect(view.canAdd).toBe(true);
  });

  it('своя: строка «V · BC · ноль» в метрике, активная отмечена, учебная — нет', () => {
    const view = rifleListView([own308, own65], 'profile-2', 'metric', true);
    expect(view.course.isActive).toBe(false);
    expect(view.own).toEqual([
      { id: 'profile-1', name: 'Моя .308', line: 'V 792 м/с · G7 0,243 · ноль 100 м', isActive: false },
      { id: 'profile-2', name: 'Шестёрка', line: 'V 826 м/с · G7 0,326 · ноль 100 м', isActive: true },
    ]);
  });

  it('в имперских единицах: фут/с и ярды', () => {
    const [row] = rifleListView([own308], null, 'imperial', true).own;
    expect(row.line).toBe('V 2600 фут/с · G7 0,243 · ноль 109 ярдов');
  });

  it('без Pro и с одной своей — добавить нельзя', () => {
    expect(rifleListView([own308], null, 'metric', false).canAdd).toBe(false);
    expect(rifleListView([own308], null, 'metric', true).canAdd).toBe(true);
  });
});
