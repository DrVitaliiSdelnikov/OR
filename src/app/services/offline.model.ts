export interface OfflinePlatform {
  isDevMode: boolean;
  isNativePlatform: boolean;
}

export function isOfflineCacheEnabled(platform: OfflinePlatform): boolean {
  return !platform.isDevMode && !platform.isNativePlatform;
}

export async function reloadIfNewVersion(checkForUpdate: () => Promise<boolean>, reload: () => void): Promise<void> {
  try {
    if (await checkForUpdate()) {
      reload();
    }
  } catch {
    return;
  }
}
