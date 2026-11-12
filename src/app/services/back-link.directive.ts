import { Directive, inject, input } from '@angular/core';
import { BackStackService } from './back-stack.service';

@Directive({
  selector: 'a[orBackLink]',
  host: { '[attr.href]': 'orBackLink()', '(click)': 'goBack($event)' },
})
export class BackLinkDirective {
  private readonly backStack = inject(BackStackService);
  readonly orBackLink = input.required<string>();

  protected goBack(event: MouseEvent): void {
    event.preventDefault();
    this.backStack.backFromPage(this.orBackLink());
  }
}
