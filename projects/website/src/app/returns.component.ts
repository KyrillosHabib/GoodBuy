import { Component, OnInit, inject, signal } from '@angular/core';
import { I18nService } from '@shared/core/i18n.service';
import { ReturnPolicy } from '@shared/core/models';
import { PublicApiService } from '@shared/core/public-api.service';
import { TranslatePipe } from '@shared/core/pipes';

// Returns and exchange: written from the rules the owner chose in the dashboard (plus the owner's own text)
@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './returns.component.html',
})
export class ReturnsComponent implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly i18n = inject(I18nService);

  readonly policy = signal<ReturnPolicy | null>(null);

  ngOnInit(): void {
    this.api.getReturnPolicy().subscribe({ next: (p) => this.policy.set(p), error: () => undefined });
  }

  extra(p: ReturnPolicy): string {
    const c = p.conditions ?? {};

    return (c[this.i18n.lang()] || c['en'] || '').trim();
  }
}
