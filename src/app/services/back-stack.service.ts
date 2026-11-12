import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonRouterOutlet, NavController, Platform } from '@ionic/angular/standalone';
import { EXIT_HINT_MS, LayerStack, parentRoute, systemBackAction } from './back-stack.model';

// Above Ionic's own router pop (0), below its overlays (100): we close our layers instead of popping the page.
const SYSTEM_BACK_PRIORITY = 50;

@Injectable({ providedIn: 'root' })
export class BackStackService {
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly navController = inject(NavController);
  private readonly layers = new LayerStack();
  private outlet: IonRouterOutlet | null = null;
  private pageHandler: (() => void) | null = null;
  private exitHintShownAtMs: number | null = null;
  private exitHintTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly exitHintShown = signal(false);

  readonly isExitHintShown = this.exitHintShown.asReadonly();

  start(outlet: IonRouterOutlet): void {
    this.outlet = outlet;
    this.platform.backButton.subscribeWithPriority(SYSTEM_BACK_PRIORITY, () => this.systemBack());
    if (Capacitor.isNativePlatform()) {
      // The plugin hands the Android back key to the page only while someone listens; Ionic then fires 'backbutton'.
      void App.addListener('backButton', () => undefined);
    }
  }

  openLayer(close: () => void): number {
    return this.layers.open(close);
  }

  removeLayer(id: number): void {
    this.layers.remove(id);
  }

  setPageHandler(handler: (() => void) | null): void {
    this.pageHandler = handler;
  }

  backFromPage(fallbackUrl: string): void {
    if (this.outlet?.canGoBack()) {
      void this.navController.pop();
      return;
    }
    void this.navController.navigateBack(fallbackUrl);
  }

  private systemBack(): void {
    const url = this.router.url;
    const action = systemBackAction({
      hasLayer: this.layers.size > 0,
      hasPageHandler: this.pageHandler !== null,
      canGoBack: this.outlet?.canGoBack() ?? false,
      url,
      nowMs: Date.now(),
      exitHintShownAtMs: this.exitHintShownAtMs,
      canExitApp: Capacitor.isNativePlatform(),
    });
    switch (action) {
      case 'close-layer':
        this.layers.closeTop();
        return;
      case 'page':
        this.pageHandler?.();
        return;
      case 'history':
        void this.navController.pop();
        return;
      case 'parent':
        void this.navController.navigateBack(parentRoute(url) ?? '/');
        return;
      case 'exit-hint':
        this.showExitHint();
        return;
      case 'exit':
        void App.exitApp();
        return;
      case 'none':
        return;
    }
  }

  private showExitHint(): void {
    this.exitHintShownAtMs = Date.now();
    this.exitHintShown.set(true);
    if (this.exitHintTimer) {
      clearTimeout(this.exitHintTimer);
    }
    this.exitHintTimer = setTimeout(() => this.exitHintShown.set(false), EXIT_HINT_MS);
  }
}

export function backLayer(isOpen: () => boolean, close: () => void): void {
  const backStack = inject(BackStackService);
  let layerId: number | null = null;
  effect(() => {
    const isLayerOpen = isOpen();
    untracked(() => {
      if (isLayerOpen && layerId === null) {
        layerId = backStack.openLayer(close);
      } else if (!isLayerOpen && layerId !== null) {
        backStack.removeLayer(layerId);
        layerId = null;
      }
    });
  });
  inject(DestroyRef).onDestroy(() => {
    if (layerId !== null) {
      backStack.removeLayer(layerId);
    }
  });
}
