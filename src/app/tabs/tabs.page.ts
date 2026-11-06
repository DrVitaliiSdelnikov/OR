import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { appsOutline, documentTextOutline, listOutline, locateOutline } from 'ionicons/icons';

@Component({
  selector: 'or-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="hub" data-test="tab-hub">
          <ion-icon name="apps-outline" />
          <ion-label>Хаб</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="calc" data-test="tab-calc">
          <ion-icon name="locate-outline" />
          <ion-label>Расчёт</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="dope" data-test="tab-dope">
          <ion-icon name="document-text-outline" />
          <ion-label>DOPE</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="log" data-test="tab-log">
          <ion-icon name="list-outline" />
          <ion-label>Журнал</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    ion-tab-bar {
      height: 84px;
      padding: 6px 8px 22px;
    }
    ion-tab-button {
      position: relative;
      min-height: 48px;
      font: 500 13px/14px var(--font-sans);
    }
    ion-tab-button.tab-selected::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 25%;
      right: 25%;
      height: 3px;
      border-radius: 0 0 3px 3px;
      background: var(--hub-accent);
    }
  `,
})
export class TabsPage {
  constructor() {
    addIcons({ appsOutline, locateOutline, documentTextOutline, listOutline });
  }
}
