import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { AssetUrlPipe } from '@shared/core/pipes';
import { CategoryAdmin, SiteSettingsAdmin } from '@shared/core/models';
import { ToastService } from '@shared/core/toast.service';
import { PAGE_KEYS, ABOUT_BLOCK_KINDS, ABOUT_FIELDS, AboutBlockKind, COLLAGE_LAYOUTS, CollageImage, LinkKind, SectionCfg, SectionType, StorefrontCfg, newAboutBlock, newSection, parseStorefront } from '@shared/core/storefront';
import './storefront-admin.i18n';

const LINKS: { kind: LinkKind; ar: string; en: string }[] = [
  { kind: 'new', ar: 'وصل حديثاً', en: 'New arrivals' },
  { kind: 'best', ar: 'الأكثر مبيعاً', en: 'Best sellers' },
  { kind: 'offers', ar: 'العروض', en: 'Offers' },
  { kind: 'bundles', ar: 'الباقات', en: 'Bundles' },
  { kind: 'category', ar: 'قسم', en: 'A category' },
  { kind: 'custom', ar: 'رابط مخصص', en: 'Custom link' },
];

const NAMES: Record<SectionType, [string, string]> = {
  categories: ['تسوق حسب القسم', 'Shop by category'],
  new: ['وصل حديثاً', 'New arrivals'],
  offers: ['العروض الساخنة', 'Hot offers'],
  best: ['الأكثر مبيعاً', 'Best sellers'],
  bundles: ['الباقات', 'Bundles'],
  featured: ['منتجات مميزة', 'Featured products'],
  features: ['لماذا نحن', 'Why us'],
  brands: ['الماركات', 'Brands'],
  video: ['فيديو', 'Video'],
  collage: ['كولاج صور', 'Image collage'],
};

const ABOUT_GROUPS = [
  { ar: '01 · قصتنا', en: '01 · Our story', prefixes: ['story'] },
  { ar: '02 · ما نؤمن به (4 قيم)', en: '02 · What we believe in (4 values)', prefixes: ['values', 'v1', 'v2', 'v3', 'v4'] },
  { ar: 'الختام', en: 'Closing', prefixes: ['close'] },
];

import { IntroComponent } from './intro.component';

type Tab = 'strip' | 'sections' | 'media' | 'about' | 'pages';

// The owner decides here what the home page shows. Three tabs: the strip after the slider, the order and
// colours of the sections, and the video / image-collage sections. Saved as one JSON text in the site settings.
@Component({
  selector: 'app-storefront-admin',
  standalone: true,
  imports: [NgTemplateOutlet, AssetUrlPipe, IntroComponent],
  templateUrl: './storefront-admin.component.html',
  styleUrl: './storefront-admin.component.css',
})
export class StorefrontAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly links = LINKS;
  readonly aboutTab = signal<'basics' | 'texts' | 'journey' | 'blocks'>('basics');
  readonly aboutGroups = ABOUT_GROUPS.map((g) => ({ ar: g.ar, en: g.en, fields: ABOUT_FIELDS.filter((f) => g.prefixes.some((x) => f.key.startsWith(x))) }));
  readonly aboutImages: { key: 'hero' | 'story' | 'journey'; ar: string; en: string }[] = [
    { key: 'story', ar: 'صورة القصة', en: 'Story picture' },
  ];
  readonly layouts = COLLAGE_LAYOUTS;
  readonly tab = signal<Tab>('strip');
  readonly pageKeys = PAGE_KEYS;
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly categories = signal<CategoryAdmin[]>([]);

  cfg: StorefrontCfg | null = null;
  // Which picture slot of each collage is being edited
  sel: Record<string, number> = {};
  private settings: SiteSettingsAdmin | null = null;

  tx(ar: string, en: string): string {
    return this.i18n.lang() === 'ar' ? ar : en;
  }

  name(s: SectionCfg): string {
    const n = NAMES[s.type];

    return this.i18n.lang() === 'ar' ? n[0] : n[1];
  }

  ngOnInit(): void {
    this.api.getSettings().subscribe((s) => {
      this.settings = s;
      this.cfg = parseStorefront(s.storefrontJson);
      this.cfg.sections.filter((x) => x.type === 'collage').forEach((x) => this.fillSlots(x));
    });
    this.api.getCategories().subscribe((c) => this.categories.set(c));
  }

  move(i: number, by: number): void {
    const list = this.cfg!.sections;
    const [x] = list.splice(i, 1);
    list.splice(i + by, 0, x);
  }

  add(type: SectionType): void {
    const s = newSection(type);

    if (type === 'collage') this.fillSlots(s);
    this.cfg!.sections.push(s);
  }

  // A shape with a fixed number of pictures always shows that many slots
  private count(s: SectionCfg): number {
    return COLLAGE_LAYOUTS.find((l) => l.id === s.collage.layout)?.count ?? 0;
  }

  private emptyImage(s: SectionCfg): CollageImage {
    return { imageUrl: '', title: { ar: '', en: '' }, text: { ar: '', en: '' }, link: { kind: 'new', value: '' }, width: s.collage.layout === 'rects' ? 33 : 25 };
  }

  private fillSlots(s: SectionCfg): void {
    const n = this.count(s);

    while (n > 0 && s.collage.images.length < n) s.collage.images.push(this.emptyImage(s));
  }

  setLayout(s: SectionCfg, id: SectionCfg['collage']['layout']): void {
    s.collage.layout = id;
    this.fillSlots(s);
    this.sel[s.id] = 0;
  }

  // A shape with a fixed number of pictures shows only that many slots (extra old pictures are kept but hidden)
  visible(s: SectionCfg): CollageImage[] {
    const n = this.count(s);

    return n > 0 ? s.collage.images.slice(0, n) : s.collage.images;
  }

  slot(s: SectionCfg): number {
    return Math.min(this.sel[s.id] ?? 0, Math.max(0, this.visible(s).length - 1));
  }

  canAddSlot(s: SectionCfg): boolean {
    return this.count(s) === 0;
  }

  addImage(s: SectionCfg): void {
    s.collage.images.push(this.emptyImage(s));
    this.sel[s.id] = s.collage.images.length - 1;
  }

  removeImage(s: SectionCfg, j: number): void {
    s.collage.images.splice(j, 1);
    this.sel[s.id] = Math.max(0, j - 1);
  }

  addStop(): void {
    this.cfg!.timeline.push({ year: '', title: { ar: '', en: '' }, text: { ar: '', en: '' }, imageUrl: '', videoUrl: '' });
  }

  moveBlock(i: number, by: number): void {
    const list = this.cfg!.about.blocks;
    const [x] = list.splice(i, 1);
    list.splice(i + by, 0, x);
  }

  removeBlock(i: number): void {
    this.cfg!.about.blocks.splice(i, 1);
  }

  addBlock(kind: AboutBlockKind): void {
    this.cfg!.about.blocks.push(newAboutBlock(kind));
  }

  // The built-in sections that were removed and can be brought back
  missingBlocks(): AboutBlockKind[] {
    const have = new Set(this.cfg?.about.blocks.map((b) => b.kind));

    return ABOUT_BLOCK_KINDS.filter((k) => k !== 'custom' && !have.has(k));
  }

  blockName(kind: AboutBlockKind): string {
    const names: Record<AboutBlockKind, [string, string]> = {
      story: ['قصتنا', 'Our story'],
      stats: ['الأرقام', 'The numbers'],
      values: ['القيم', 'Values'],
      journey: ['الرحلة (الخط الزمني)', 'Journey (timeline)'],
      closing: ['الختام', 'Closing'],
      custom: ['قسم جديد', 'New section'],
    };

    return this.tx(names[kind][0], names[kind][1]);
  }

  moveStop(i: number, by: number): void {
    const list = this.cfg!.timeline;
    const [x] = list.splice(i, 1);
    list.splice(i + by, 0, x);
  }

  uploadVideo(event: Event, target: { url?: string; videoUrl?: string }): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.uploading.set(true);
    this.api.uploadVideo(file).subscribe({
      next: (r) => { if ('videoUrl' in target) target.videoUrl = r.url; else target.url = r.url; this.uploading.set(false); input.value = ''; },
      error: () => { this.uploading.set(false); input.value = ''; },
    });
  }

  upload(event: Event, target: any, key: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.api.uploadImage(file).subscribe({ next: (r) => { target[key] = r.url; input.value = ''; }, error: () => (input.value = '') });
  }

  // datetime-local is the owner's clock; the value is kept as UTC
  endsLocal(): string {
    const v = this.cfg?.strip.endsAt;

    if (!v) return '';

    const d = new Date(v);
    const p = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  setEnds(value: string): void {
    this.cfg!.strip.endsAt = value ? new Date(value).toISOString() : null;
  }

  save(): void {
    if (!this.cfg || !this.settings) return;

    this.saving.set(true);
    const json = JSON.stringify(this.cfg);

    this.api.updateSettings({ ...this.settings, storefrontJson: json }).subscribe({
      next: () => {
        this.settings!.storefrontJson = json;
        this.saving.set(false);
        this.toast.success(this.tx('تم الحفظ', 'Saved'));
      },
      error: () => this.saving.set(false),
    });
  }
}
