import { describe, expect, it } from 'vitest';
import { EXIT_HINT_MS, LayerStack, parentRoute, SystemBackContext, systemBackAction } from './back-stack.model';

function openLayers(stack: LayerStack, closed: string[], names: string[]): Record<string, number> {
  return Object.fromEntries(names.map(name => [name, stack.open(() => closed.push(name))]));
}

const AT_REST: SystemBackContext = { hasLayer: false, hasPageHandler: false, canGoBack: false, url: '/journal', nowMs: 10_000, exitHintShownAtMs: null, canExitApp: true };

describe('LayerStack (A8)', () => {
  it('U1: «назад» закрывает слои с верхнего; пустой стек — ничего не закрыто', () => {
    const stack = new LayerStack();
    const closed: string[] = [];
    openLayers(stack, closed, ['A', 'B', 'C']);
    expect(stack.closeTop()).toBe(true);
    expect(stack.closeTop()).toBe(true);
    expect(closed).toEqual(['C', 'B']);
    expect(stack.closeTop()).toBe(true);
    expect(stack.closeTop()).toBe(false);
    expect(closed).toEqual(['C', 'B', 'A']);
  });

  it('U2: слой, закрытый сам, уходит из стека; открытый заново — наверху', () => {
    const stack = new LayerStack();
    const closed: string[] = [];
    const ids = openLayers(stack, closed, ['A', 'B', 'C']);
    stack.remove(ids['B']);
    stack.closeTop();
    stack.closeTop();
    expect(closed).toEqual(['C', 'A']);
    expect(stack.size).toBe(0);

    const again = openLayers(stack, closed, ['A', 'B']);
    stack.remove(again['A']);
    openLayers(stack, closed, ['A']);
    stack.closeTop();
    expect(closed.at(-1)).toBe('A');
  });
});

describe('systemBackAction (A8)', () => {
  it('U3: слой → обработчик страницы → история → родитель', () => {
    expect(systemBackAction({ ...AT_REST, hasLayer: true, hasPageHandler: true, canGoBack: true })).toBe('close-layer');
    expect(systemBackAction({ ...AT_REST, hasPageHandler: true, canGoBack: true })).toBe('page');
    expect(systemBackAction({ ...AT_REST, canGoBack: true })).toBe('history');
    expect(systemBackAction(AT_REST)).toBe('parent');
  });

  it('U3: главный — подсказка, второй раз за 2 с — выход, позже — снова подсказка; без выхода — ничего', () => {
    const home = { ...AT_REST, url: '/', canGoBack: true };
    expect(systemBackAction(home)).toBe('exit-hint');
    expect(systemBackAction({ ...home, exitHintShownAtMs: home.nowMs - EXIT_HINT_MS })).toBe('exit');
    expect(systemBackAction({ ...home, exitHintShownAtMs: home.nowMs - EXIT_HINT_MS - 1 })).toBe('exit-hint');
    expect(systemBackAction({ ...home, exitHintShownAtMs: home.nowMs - 100, canExitApp: false })).toBe('none');
    expect(systemBackAction({ ...home, hasLayer: true })).toBe('close-layer');
  });

  it('U4: у каждого экрана, кроме главного, есть родитель', () => {
    expect(parentRoute('/')).toBeNull();
    expect(parentRoute('/course')).toBe('/');
    expect(parentRoute('/course/04')).toBe('/course');
    expect(parentRoute('/intro')).toBe('/course/00');
    expect(parentRoute('/position/04?instructor=on')).toBe('/course/04');
    expect(parentRoute('/position/free')).toBe('/free');
    expect(parentRoute('/position/free?sandbox=MIL')).toBe('/textbook');
    for (const url of ['/free', '/journal', '/textbook', '/settings']) {
      expect(parentRoute(url)).toBe('/');
    }
  });
});
