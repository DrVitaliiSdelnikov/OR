import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isOfflineCacheEnabled } from './offline.model';

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
