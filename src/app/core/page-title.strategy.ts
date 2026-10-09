import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { documentTitle } from './page-title';

// Angular's own strategy sets the title to the route's `title` alone; this one adds the app's name
// after it (documentTitle), so each route only has to say what the page is. Provided in place of
// Angular's through the TitleStrategy token (app.config.ts), hence @Injectable() rather than @Service.
@Injectable()
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(documentTitle(this.buildTitle(snapshot)));
  }
}
