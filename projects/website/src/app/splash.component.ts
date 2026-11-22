import { Component, effect, inject, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon.component';
import { AssetUrlPipe } from '@shared/core/pipes';
import { SiteService } from '@shared/core/site.service';

const CACHE_KEY = 'voltara_splash';

// Opening screen: the company logo on the site colors, then the site opens.
// It is OFF unless the owner switches it on in the dashboard (Settings > Opening screen), and the owner sets how many seconds it stays.
// The choice is kept in the browser, so from the second visit the screen decides at once (no flash while the settings load).
@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [AssetUrlPipe, IconComponent],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.css',
})
export class SplashComponent {
  readonly site = inject(SiteService);

  readonly visible = signal(false);
  readonly leaving = signal(false);

  private readonly started = Date.now();
  private seconds = this.cached();

  constructor() {
    if (this.seconds > 0) {
      this.visible.set(true);
      document.body.classList.add('modal-open');

      // Never block the site for long, even when the API is slow
      setTimeout(() => this.finish(), this.seconds * 1000 + 4000);
    } else {
      this.ready();
    }

    effect(() => {
      const settings = this.site.home()?.settings;

      if (!settings) return;

      const wanted = settings.splashEnabled ? Math.min(10, Math.max(1, settings.splashSeconds || 2)) : 0;

      try { localStorage.setItem(CACHE_KEY, String(wanted)); } catch { /* storage blocked */ }

      if (!this.visible()) {
        this.ready();
        return;
      }

      // Switched off since the last visit: it closes at once; otherwise it stays for the seconds that were set
      const calm = document.documentElement.classList.contains('no-anim');
      const wait = wanted === 0 || calm ? 0 : Math.max(0, wanted * 1000 - (Date.now() - this.started));

      setTimeout(() => this.finish(), wait);
    });
  }

  private cached(): number {
    try {
      return Number(localStorage.getItem(CACHE_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  // The entrance motion of the cover waits for this: it must not play behind the opening screen
  private ready(): void {
    document.documentElement.classList.add('site-ready');
  }

  private finish(): void {
    if (this.leaving() || !this.visible()) return;

    this.leaving.set(true);
    this.ready();

    setTimeout(() => {
      this.visible.set(false);
      document.body.classList.remove('modal-open');
    }, 700);
  }
}
