import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { AssetUrlPipe, ImageOrPipe, TranslatePipe } from '@shared/core/pipes';
import { SiteService } from '@shared/core/site.service';
import { ABOUT_FIELDS, Bi, parseStorefront, pickText } from '@shared/core/storefront';
import { I18nService } from '@shared/core/i18n.service';
import './storefront.i18n';
import { RevealDirective, CountUpDirective } from './motion.directives';

// "About us": what used to fill the home page of the company site (about, services, how we work, certificates, markets, FAQ).
// The home page is the shop now.
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, TranslatePipe, AssetUrlPipe, ImageOrPipe, IconComponent, RevealDirective, CountUpDirective],
  templateUrl: './about.component.html',
})
export class AboutComponent {

  readonly site = inject(SiteService);
  private readonly i18n = inject(I18nService);

  // The journey of the company, written in the dashboard (Storefront -> About page)
  readonly timeline = computed(() => parseStorefront(this.site.home()?.settings.storefrontJson).timeline.filter((x) => x.year || x.title.ar || x.title.en || x.text.ar || x.text.en));

  t(texts: Bi): string {
    return pickText(texts, this.i18n.lang());
  }

  readonly cfg = computed(() => parseStorefront(this.site.home()?.settings.storefrontJson));
  // Only the blocks the owner left visible, in their order
  readonly blocks = computed(() => this.cfg().about.blocks.filter((b) => b.enabled));

  // The small numbers (01, 02, 03) go to the story, values and journey blocks in the order they show
  no(id: string): string {
    const n = this.blocks().filter((b) => b.kind === 'story' || b.kind === 'values' || b.kind === 'journey').findIndex((b) => b.id === id) + 1;

    return n < 10 ? `0${n}` : `${n}`;
  }

  readonly since = computed(() => this.cfg().about.since.trim());
  readonly valueNos = [1, 2, 3, 4];

  // A text of the page: what the owner wrote in the dashboard, or the default ({brand} is the company name)
  a(key: string): string {
    const f = ABOUT_FIELDS.find((x) => x.key === key);
    const lang = this.i18n.lang();
    const own = pickText(this.cfg().about.texts[key], lang);
    const text = own || (f ? (lang === 'ar' ? f.ar : f.en) : '');

    return text.split('{brand}').join(this.site.home()?.company.companyName ?? '');
  }

  readonly faqs = [1, 2, 3, 4, 5];

  readonly whatsappLink = computed(() => {
    const digits = (this.site.home()?.company.whatsAppNumber ?? '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

}
