import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

function motionOff(): boolean {
  return document.documentElement.classList.contains('no-anim');
}

// Fades / slides the element in when it scrolls into view.   <div [appReveal]="index * 80">
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  // Delay in ms (used to stagger neighbours)
  @Input('appReveal') delay: number | '' = 0;

  ngOnInit(): void {
    const node = this.el.nativeElement;

    node.classList.add('reveal');
    node.style.setProperty('--reveal-delay', `${Number(this.delay) || 0}ms`);

    if (motionOff() || typeof IntersectionObserver === 'undefined') {
      node.classList.add('in');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.classList.add('in');
          this.observer?.disconnect();

          // Once shown, drop the helper class so the card's own hover animation takes over again
          setTimeout(() => node.classList.remove('reveal'), (Number(this.delay) || 0) + 900);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

// Counts a value like "14+" or "1,200" up from zero when it becomes visible.
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private frame = 0;

  @Input('appCountUp') value: string | null = '';

  ngOnInit(): void {
    const node = this.el.nativeElement;
    const text = (this.value ?? '').trim();
    const match = /^(\D*)(\d[\d,.]*)(.*)$/.exec(text);

    node.textContent = text;

    if (!match || motionOff() || typeof IntersectionObserver === 'undefined') return;

    const [, prefix, numberText, suffix] = match;
    const target = Number(numberText.replace(/,/g, ''));

    if (!Number.isFinite(target) || target === 0) return;

    const decimals = numberText.includes('.') ? numberText.split('.')[1].length : 0;
    const grouped = numberText.includes(',');

    const format = (n: number) =>
      prefix + (grouped ? n.toLocaleString('en-US', { maximumFractionDigits: decimals }) : n.toFixed(decimals)) + suffix;

    node.textContent = format(0);

    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;

      this.observer?.disconnect();

      const started = performance.now();
      // Small numbers count slowly so the visitor can enjoy every step
      const duration = target <= 20 ? 4200 : target <= 100 ? 3400 : target <= 1000 ? 2800 : 2400;

      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        const eased = t * (2 - t);

        node.textContent = format(target * eased);

        if (t < 1) this.frame = requestAnimationFrame(tick);
        else node.textContent = text;
      };

      this.frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });

    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
