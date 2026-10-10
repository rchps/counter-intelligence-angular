import { Component, inject } from '@angular/core';
import { TourService } from '../../core/tour.service';

// The guided tour's first-visit invite, under the Line Card's intro. Offered rather than started: someone
// may have opened the page with a customer at the counter, and a tour that takes over the screen then is
// in the way (NN/g, "Onboarding Tutorials vs. Contextual Help"). It sits in the page instead of floating,
// so it never covers anything, and it's gone for good once the tour is started or turned down. The
// footer's "Take the tour" replays it anytime.
@Component({
  selector: 'app-tour-invite',
  styleUrl: './tour-invite.component.scss',
  template: `
    @if (tour.inviteShown()) {
      <section class="invite" aria-labelledby="tour-invite-text" data-cy="tour-invite">
        <p id="tour-invite-text">
          <b>New here?</b> A 30-second tour shows the handy parts that are easy to miss.
        </p>
        <div class="actions">
          <button
            type="button"
            class="take touch-target"
            data-cy="tour-invite-start"
            (click)="tour.start($event.currentTarget)"
          >
            Take the tour
          </button>
          <button
            type="button"
            class="no touch-target"
            data-cy="tour-invite-dismiss"
            (click)="tour.dismissInvite()"
          >
            No thanks
          </button>
        </div>
      </section>
    }
  `,
})
export class TourInviteComponent {
  protected readonly tour = inject(TourService);
}
