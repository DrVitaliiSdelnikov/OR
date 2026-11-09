import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TermSheetService {
  private readonly shown = signal<string | null>(null);

  readonly openTerm = this.shown.asReadonly();

  open(term: string): void {
    this.shown.set(term);
  }

  close(): void {
    this.shown.set(null);
  }
}
