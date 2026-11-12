export const EXIT_HINT_MS = 2000;

const HOME_URL = '/';
const FREE_PLAY_ID = 'free';
const SANDBOX_PARAM = 'sandbox';

export type SystemBackAction = 'close-layer' | 'page' | 'history' | 'parent' | 'exit-hint' | 'exit' | 'none';

export interface SystemBackContext {
  hasLayer: boolean;
  hasPageHandler: boolean;
  canGoBack: boolean;
  url: string;
  nowMs: number;
  exitHintShownAtMs: number | null;
  canExitApp: boolean;
}

interface BackLayer {
  id: number;
  close: () => void;
}

export class LayerStack {
  private layers: BackLayer[] = [];
  private nextId = 0;

  get size(): number {
    return this.layers.length;
  }

  open(close: () => void): number {
    const id = this.nextId++;
    this.layers.push({ id, close });
    return id;
  }

  remove(id: number): void {
    this.layers = this.layers.filter(layer => layer.id !== id);
  }

  closeTop(): boolean {
    const top = this.layers.pop();
    top?.close();
    return top !== undefined;
  }
}

export function systemBackAction(context: SystemBackContext): SystemBackAction {
  if (context.hasLayer) {
    return 'close-layer';
  }
  if (context.hasPageHandler) {
    return 'page';
  }
  if (pathOf(context.url) === HOME_URL) {
    const isHintShowing = context.exitHintShownAtMs !== null && context.nowMs - context.exitHintShownAtMs <= EXIT_HINT_MS;
    if (!isHintShowing) {
      return 'exit-hint';
    }
    return context.canExitApp ? 'exit' : 'none';
  }
  if (context.canGoBack) {
    return 'history';
  }
  return parentRoute(context.url) === null ? 'none' : 'parent';
}

export function parentRoute(url: string): string | null {
  const [path, query = ''] = url.split('#')[0].split('?');
  const segments = path.split('/').filter(segment => segment !== '');
  const [section, id] = segments;
  if (segments.length === 0) {
    return null;
  }
  if (section === 'course' && id !== undefined) {
    return '/course';
  }
  if (section === 'intro') {
    return '/course/00';
  }
  if (section === 'position') {
    if (new URLSearchParams(query).has(SANDBOX_PARAM)) {
      return '/textbook';
    }
    return id === FREE_PLAY_ID ? '/free' : `/course/${id}`;
  }
  return HOME_URL;
}

function pathOf(url: string): string {
  const path = url.split('#')[0].split('?')[0];
  return path === '' ? HOME_URL : path;
}
