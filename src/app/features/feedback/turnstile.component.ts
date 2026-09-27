import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

// Cloudflare Turnstile, the feedback dialog's bot check: developers.cloudflare.com/turnstile/get-started/
// client-side-rendering/. It shows nothing unless Cloudflare wants the person to click (interaction-only),
// and hands back a token the Worker checks before filing anything.
interface TurnstileOptions {
  sitekey: string;
  action: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  size: 'normal' | 'flexible' | 'compact';
  theme: 'auto' | 'light' | 'dark';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare asks that the script be loaded from exactly this address, never copied or proxied, so it
// can't be bundled. `render=explicit` waits for render() instead of scanning the page for widgets.
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoad: Promise<TurnstileApi> | null = null;

/** Adds the script once, the first time any widget is drawn. A failed load can be tried again. */
function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'));
    script.onerror = () => {
      script.remove();
      scriptLoad = null;
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.append(script);
  });
  return scriptLoad;
}

@Component({
  selector: 'app-turnstile',
  template: '',
  host: { 'data-cy': 'turnstile' },
})
export class TurnstileComponent {
  readonly siteKey = input.required<string>();
  readonly action = input.required<string>();

  private readonly tokenSignal = signal<string | null>(null);
  /** The widget's answer, or null while it's still checking, after it expires, or after a reset. */
  readonly token = this.tokenSignal.asReadonly();
  private readonly failedSignal = signal(false);
  /** The script didn't load or the check errored, so no token is coming. */
  readonly failed = this.failedSignal.asReadonly();

  private api: TurnstileApi | null = null;
  private widgetId: string | null = null;
  private destroyed = false;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.api && this.widgetId) this.api.remove(this.widgetId);
    });

    afterNextRender(async () => {
      try {
        const api = await loadTurnstile();
        if (this.destroyed) return;
        this.api = api;
        this.widgetId =
          api.render(host, {
            sitekey: this.siteKey(),
            action: this.action(),
            appearance: 'interaction-only',
            size: 'flexible',
            theme: 'auto',
            callback: (token) => {
              this.failedSignal.set(false);
              this.tokenSignal.set(token);
            },
            'expired-callback': () => this.tokenSignal.set(null),
            'error-callback': () => {
              this.tokenSignal.set(null);
              this.failedSignal.set(true);
            },
          }) ?? null;
      } catch {
        if (!this.destroyed) this.failedSignal.set(true);
      }
    });
  }

  /** A token works once, so after each send ask for a fresh one. */
  reset(): void {
    this.tokenSignal.set(null);
    if (this.api && this.widgetId && !this.destroyed) this.api.reset(this.widgetId);
  }
}
