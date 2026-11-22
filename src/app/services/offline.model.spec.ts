import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isOfflineCacheEnabled, reloadIfNewVersion } from './offline.model';

interface AssetGroup {
  name: string;
  installMode: string;
  resources: { files?: string[] };
}

const ngswConfig = JSON.parse(readFileSync('ngsw-config.json', 'utf-8')) as { index: string; assetGroups: AssetGroup[]; navigationUrls?: string[] };
const prefetched = ngswConfig.assetGroups.filter(group => group.installMode === 'prefetch').flatMap(group => group.resources.files ?? []);

describe('офлайн-демо (T5.4)', () => {
  it('кеш включён только в продакшен-сборке в браузере', () => {
    expect(isOfflineCacheEnabled({ isDevMode: false, isNativePlatform: false })).toBe(true);
    expect(isOfflineCacheEnabled({ isDevMode: true, isNativePlatform: false })).toBe(false);
    expect(isOfflineCacheEnabled({ isDevMode: false, isNativePlatform: true })).toBe(false);
  });

  it('при первом визите кешируется всё приложение: скрипты, стили, шрифты, картинки сцены', () => {
    expect(ngswConfig.index).toBe('/index.html');
    expect(prefetched).toEqual(expect.arrayContaining(['/index.html', '/*.js', '/*.css', '/favicon.ico', '/media/*.woff2', '/scene/**']));
  });

  it('навигация по любым адресам приложения отдаёт index.html', () => {
    expect(ngswConfig.navigationUrls ?? ['/**']).toContain('/**');
  });
});

describe('новая версия при запуске (В62)', () => {
  it('нашлась новая версия — сразу перезагрузка в неё', async () => {
    let reloads = 0;
    await reloadIfNewVersion(() => Promise.resolve(true), () => reloads++);
    expect(reloads).toBe(1);
  });

  it('версия та же или проверка не удалась (нет сети) — без перезагрузки', async () => {
    let reloads = 0;
    await reloadIfNewVersion(() => Promise.resolve(false), () => reloads++);
    await reloadIfNewVersion(() => Promise.reject(new Error('offline')), () => reloads++);
    expect(reloads).toBe(0);
  });
});
