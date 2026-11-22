import { Component, Input } from '@angular/core';
import { PageBanner } from '@shared/core/storefront';
import { AssetUrlPipe } from '@shared/core/pipes';

// A picture or a video over the top of a shop page with the name of the page written on it (set in the dashboard: Storefront -> Page banners)
@Component({
  selector: 'app-page-banner',
  standalone: true,
  imports: [AssetUrlPipe],
  templateUrl: './page-banner.component.html',
})
export class PageBannerComponent {
  @Input({ required: true }) banner!: PageBanner;
  @Input() title = '';
}
