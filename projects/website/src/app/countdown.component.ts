import { Component, Input, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { TranslatePipe } from '@shared/core/pipes';
import './storefront.i18n';

// The time left of an offer: days, hours, minutes and seconds, counting down by itself. When it reaches zero nothing is shown.
@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './countdown.component.html',
})
export class CountdownComponent implements OnInit, OnDestroy {
  private end = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now = signal(Date.now());

  // The large version (strip after the slider)
  @Input() big = false;
  // The small one-line version
  @Input() inline = false;

  @Input({ required: true }) set endsAt(value: string | Date | null) {
    this.end = value ? new Date(value).getTime() : 0;
    this.now.set(Date.now());
  }

  readonly left = computed(() => Math.max(0, Math.floor((this.end - this.now()) / 1000)));
  readonly days = computed(() => Math.floor(this.left() / 86400));
  readonly hours = computed(() => Math.floor((this.left() % 86400) / 3600));
  readonly minutes = computed(() => Math.floor((this.left() % 3600) / 60));
  readonly seconds = computed(() => this.left() % 60);

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  ngOnInit(): void {
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
