import { DestroyRef, inject, signal } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';

// At least 8 characters with a lower-case letter, an upper-case letter and a digit (same rule as the API)
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Phone numbers: digits, spaces and + - ( )
export const PHONE_PATTERN = /^[0-9+\-\s()]+$/;

export function sameAs(first: string, second: string) {
  return (group: AbstractControl): ValidationErrors | null =>
    group.get(first)?.value === group.get(second)?.value ? null : { mismatch: true };
}

// "Send again in 42 s" timer for the e-mail code pages
export class Countdown {
  readonly seconds = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(seconds: number): void {
    this.stop();
    this.seconds.set(Math.max(0, Math.round(seconds)));

    if (this.seconds() === 0) return;

    this.timer = setInterval(() => {
      this.seconds.update((s) => s - 1);
      if (this.seconds() <= 0) this.stop();
    }, 1000);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
