import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { densityAltitudeM, formatClock } from '../../core/field';
import { mulberry32 } from '../../core/rng';
import { degFromClock, lateralWindMps } from '../../core/scenario';
import { GameSession } from '../services/game-session';
import { FeedbackService } from '../services/feedback.service';

interface LcdRow {
  label: string;
  value: string;
}

const GAUGE_NOISE_MPS = 0.3;

@Component({
  selector: 'or-weather',
  imports: [IonContent],
  templateUrl: './weather.page.html',
  styleUrl: './weather.page.scss',
})
export class WeatherPage {
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  protected readonly session = inject(GameSession);
  protected readonly pageIndex = signal(0);
  protected readonly pageCount = 3;
  private readings = 0;

  protected readonly takenAt = computed(() => {
    const snapshot = this.session.gaugeSnapshot();
    return snapshot ? new Date(snapshot.takenAtIso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;
  });

  protected readonly rows = computed<LcdRow[]>(() => {
    const snapshot = this.session.gaugeSnapshot();
    if (!snapshot) {
      return [];
    }
    const fromDeg = degFromClock(snapshot.windClock);
    const crosswind = lateralWindMps({ speedMps: snapshot.windSpeedMps, fromDeg });
    const headwind = snapshot.windSpeedMps * Math.cos((fromDeg * Math.PI) / 180);
    const pages: LcdRow[][] = [
      [
        { label: 'ТЕМП', value: `${snapshot.temperatureC.toFixed(1)} °C` },
        { label: 'ВЕТЕР', value: `${snapshot.windSpeedMps.toFixed(1)} м/с · ${formatClock(snapshot.windClock)}` },
      ],
      [
        { label: 'ДАВЛ', value: `${snapshot.pressureHpa} гПа` },
        { label: 'ВЛАЖН', value: `${Math.round(snapshot.relativeHumidity * 100)} %` },
        { label: 'DA', value: `${Math.round(densityAltitudeM(snapshot.temperatureC, snapshot.pressureHpa))} м` },
      ],
      [
        { label: 'КРОСС', value: `${Math.abs(crosswind).toFixed(1)} м/с ${crosswind >= 0 ? '→' : '←'}` },
        { label: 'ВСТРЕЧ', value: `${headwind.toFixed(1)} м/с` },
      ],
    ];
    return pages[this.pageIndex()];
  });

  protected nextPage(): void {
    this.pageIndex.update(index => (index + 1) % this.pageCount);
  }

  protected takeReading(): void {
    const noise = (mulberry32(this.session.scenario().seed + ++this.readings)() - 0.5) * 2 * GAUGE_NOISE_MPS;
    this.session.takeGaugeReading(noise);
    this.feedback.emit('gauge-read');
  }

  protected close(): void {
    void this.router.navigate(['/calc']);
  }
}
