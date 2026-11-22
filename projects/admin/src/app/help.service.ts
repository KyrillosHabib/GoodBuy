import { Injectable, signal } from '@angular/core';

// Shows or hides the explanations written under the title of each screen (the choice stays in this browser)
@Injectable({ providedIn: 'root' })
export class HelpService {
  readonly visible = signal(this.read());

  constructor() {
    this.apply();
  }

  toggle(): void {
    this.visible.update((v) => !v);

    try { localStorage.setItem('voltara.admin.help', this.visible() ? '1' : '0'); } catch { /* private window: the choice just is not kept */ }
    this.apply();
  }

  private read(): boolean {
    try { return localStorage.getItem('voltara.admin.help') !== '0'; } catch { return true; }
  }

  private apply(): void {
    document.documentElement.classList.toggle('no-help', !this.visible());
  }
}
