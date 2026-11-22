export interface OfflinePlatform {
  isDevMode: boolean;
  isNativePlatform: boolean;
}

export function isOfflineCacheEnabled(platform: OfflinePlatform): boolean {
  return !platform.isDevMode && !platform.isNativePlatform;
}
