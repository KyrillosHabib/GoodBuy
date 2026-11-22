// The storefront layout the owner controls from the dashboard (Website -> Storefront).
// It is stored as one JSON text in the site settings, so new blocks need no database change.

export interface Bi { ar: string; en: string }

export type LinkKind = 'new' | 'best' | 'offers' | 'bundles' | 'category' | 'custom';
export interface LinkTarget { kind: LinkKind; value: string }

// A thin line of plain messages above the navigation bar (not links): "Free shipping over 2000 EGP"
export interface TopbarCfg {
  enabled: boolean;
  bg: string;
  color: string;
  messages: Bi[];
}

// The words over the main banner: nothing is shown unless something is written; the colour is the owner's
export interface HeroCfg {
  title: Bi;
  subtitle: Bi;
  color: string;
  showButton: boolean;
}

export interface StripCfg {
  enabled: boolean;
  // Any CSS colour; the dashboard offers black and red first
  color: string;
  // The small bold line on top ("Black Friday offer")
  title: Bi;
  // Wide columns side by side, a thin line between them: a big headline and a small line under it
  columns: { head: Bi; sub: Bi; link: LinkTarget }[];
  // The last line ("Don't miss out · Shop now"), a link of its own
  footer: Bi;
  showCountdown: boolean;
  // Empty = the end of the nearest running discount / promotion
  endsAt: string | null;
  link: LinkTarget;
}

export interface CollageImage { imageUrl: string; title: Bi; text: Bi; link: LinkTarget; width: number }

export type SectionType = 'categories' | 'new' | 'offers' | 'best' | 'bundles' | 'featured' | 'features' | 'brands' | 'video' | 'collage';

export interface SectionCfg {
  id: string;
  type: SectionType;
  enabled: boolean;
  // Background colour of the section ('' = the default of the design)
  bg: string;
  // Optional picture behind the section, and the screen laid over it: white (light) or dark, with a strength of 0-100
  bgImage: string;
  bgTone: 'light' | 'dark';
  bgStrength: number;
  title: Bi;
  subtitle: Bi;
  video: { url: string; posterUrl: string; buttonLabel: Bi; link: LinkTarget };
  collage: { layout: CollageLayout; images: CollageImage[] };
}

// The shapes a collage can take; 'count' is how many pictures the shape uses (0 = any number)
export type CollageLayout = 'bigTwo' | 'twoBig' | 'three' | 'four' | 'five' | 'tall' | 'rects';
export const COLLAGE_LAYOUTS: { id: CollageLayout; count: number; ar: string; en: string }[] = [
  { id: 'bigTwo', count: 3, ar: 'صورة كبيرة (66%) + صورتان فوق بعض', en: 'One big (66%) + two stacked' },
  { id: 'twoBig', count: 3, ar: 'صورتان فوق بعض + صورة كبيرة (66%)', en: 'Two stacked + one big (66%)' },
  { id: 'three', count: 3, ar: '3 صور بالتساوي', en: '3 equal pictures' },
  { id: 'four', count: 4, ar: '4 مربعات متساوية', en: '4 equal squares' },
  { id: 'five', count: 5, ar: 'صورة كبيرة (50%) + 4 صغيرة', en: 'One big (50%) + 4 small' },
  { id: 'tall', count: 0, ar: 'أعمدة طويلة بطول القسم (مثل البدل)، أي عدد', en: 'Tall columns, any number (e.g. suits)' },
  { id: 'rects', count: 0, ar: 'مستطيلات بعرض تتحكم فيه', en: 'Rectangles with set widths' },
];

// One stop of the company journey on the About page: a year, a title, a few sentences and a picture or a video
export interface TimelineItem { year: string; title: Bi; text: Bi; imageUrl: string; videoUrl: string }

// ---- the About page: every text can be changed in the dashboard; an empty one shows the default below ({brand} = company name)
export interface AboutField { key: string; label: Bi; rows: number; ar: string; en: string }
export const ABOUT_FIELDS: AboutField[] = [
  { key: 'storyTitle', label: { ar: 'قصتنا: العنوان', en: 'Our story: headline' }, rows: 1, ar: 'رؤية واضحة. هوية مميزة.', en: 'A clear vision. A distinct identity.' },
  { key: 'story1', label: { ar: 'قصتنا: الفقرة 1', en: 'Our story: paragraph 1' }, rows: 3, ar: 'في قلب {brand} شغف ورؤية صاحبها. التزامه بالتفاصيل والجودة شكّل العلامة منذ أيامها الأولى ولا يزال يقود مسيرتها.', en: 'At the heart of {brand} is a passion and a vision. A dedication to detail and quality has shaped the brand since its earliest days and continues to guide its journey.' },
  { key: 'story2', label: { ar: 'قصتنا: الفقرة 2', en: 'Our story: paragraph 2' }, rows: 3, ar: 'نصمم مجموعات عصرية تجمع الجودة والراحة والأناقة البسيطة. كل قطعة تدخل حياتك اليومية بسهولة، من أيام العمل إلى عطلة نهاية الأسبوع.', en: 'We create contemporary collections that combine quality, comfort and effortless style. Every piece fits naturally into your everyday life, from workdays to weekends.' },
  { key: 'story3', label: { ar: 'قصتنا: الفقرة 3', en: 'Our story: paragraph 3' }, rows: 2, ar: 'لأن الأسلوب الجميل يجب أن يكون سهلاً دائماً.', en: 'Because great style should always feel easy.' },
  { key: 'valuesLabel', label: { ar: 'القيم: العنوان الصغير', en: 'Values: small label' }, rows: 1, ar: 'ما نؤمن به', en: 'What we believe in' },
  { key: 'valuesTitle', label: { ar: 'القيم: العنوان', en: 'Values: headline' }, rows: 1, ar: 'ثقة هادئة. شخصية تدوم.', en: 'Quiet confidence. Lasting character.' },
  { key: 'v1t', label: { ar: 'قيمة 1: العنوان', en: 'Value 1: title' }, rows: 1, ar: 'الثقة', en: 'Confidence' },
  { key: 'v1', label: { ar: 'قيمة 1: الوصف', en: 'Value 1: text' }, rows: 2, ar: 'ارتدِ ما يجعلك تشعر بأفضل حال.', en: 'Wear what makes you feel your best.' },
  { key: 'v2t', label: { ar: 'قيمة 2: العنوان', en: 'Value 2: title' }, rows: 1, ar: 'التعبير عن النفس', en: 'Self-expression' },
  { key: 'v2', label: { ar: 'قيمة 2: الوصف', en: 'Value 2: text' }, rows: 2, ar: 'تصاميم تترك مساحة للشخصية والطموح.', en: 'Designs that leave room for personality and ambition.' },
  { key: 'v3t', label: { ar: 'قيمة 3: العنوان', en: 'Value 3: title' }, rows: 1, ar: 'الجودة', en: 'Quality' },
  { key: 'v3', label: { ar: 'قيمة 3: الوصف', en: 'Value 3: text' }, rows: 2, ar: 'مصممة لتدوم أبعد من الموسم.', en: 'Designed to last beyond seasons.' },
  { key: 'v4t', label: { ar: 'قيمة 4: العنوان', en: 'Value 4: title' }, rows: 1, ar: 'الراحة', en: 'Comfort' },
  { key: 'v4', label: { ar: 'قيمة 4: الوصف', en: 'Value 4: text' }, rows: 2, ar: 'أسلوب يعكس حقيقتك، مصنوع للحركة كل يوم.', en: 'Style that reflects who you are, made for movement every day.' },
  { key: 'closeKicker', label: { ar: 'الختام: العنوان الصغير', en: 'Closing: small label' }, rows: 1, ar: 'ارتدِ أسلوبك', en: 'Wear your style' },
  { key: 'closeTitle', label: { ar: 'الختام: العنوان', en: 'Closing: headline' }, rows: 2, ar: 'الموضة أكثر مما ترتديه.', en: 'Fashion is more than what you wear.' },
  { key: 'closeText', label: { ar: 'الختام: النص', en: 'Closing: text' }, rows: 2, ar: 'إنها الثقة والتميز والتعبير عن نفسك كل يوم. في {brand} نساعدك لترتدي أسلوبك.', en: "It's confidence, individuality and expressing yourself every day. At {brand}, we're here to help you wear your style." },
  { key: 'closeReady', label: { ar: 'الختام: سؤال الزر', en: 'Closing: question above the button' }, rows: 1, ar: 'جاهز لإطلالتك القادمة؟', en: 'Ready for your next look?' },
];

// The blocks of the About page, in the order they show. The owner can hide, delete, move and add blocks.
export type AboutBlockKind = 'story' | 'stats' | 'values' | 'journey' | 'closing' | 'custom';
export const ABOUT_BLOCK_KINDS: AboutBlockKind[] = ['story', 'stats', 'values', 'journey', 'closing', 'custom'];

// A block the owner writes from scratch: a headline, a text, a picture, and an optional button
export interface AboutCustom {
  title: Bi;
  text: Bi;
  imageUrl: string;
  layout: 'imageStart' | 'imageEnd' | 'textOnly';
  buttonLabel: Bi;
  buttonUrl: string;
}

export interface AboutBlock {
  id: string;
  kind: AboutBlockKind;
  enabled: boolean;
  // Background colour of the block ('' = the design's)
  bg: string;
  custom: AboutCustom;
}

export interface AboutCfg {
  since: string;
  texts: Record<string, Bi>;
  images: { hero: string; story: string; journey: string };
  blocks: AboutBlock[];
}

export function newAboutBlock(kind: AboutBlockKind, id?: string): AboutBlock {
  return {
    id: id ?? (kind === 'custom' ? `custom-${Math.random().toString(36).slice(2, 7)}` : kind),
    kind,
    enabled: true,
    bg: '',
    custom: { title: { ar: '', en: '' }, text: { ar: '', en: '' }, imageUrl: '', layout: 'imageStart', buttonLabel: { ar: '', en: '' }, buttonUrl: '' },
  };
}

export function defaultAboutBlocks(): AboutBlock[] {
  return (['story', 'stats', 'values', 'journey', 'closing'] as AboutBlockKind[]).map((k) => newAboutBlock(k));
}

export function defaultAbout(): AboutCfg {
  return { since: '', texts: {}, images: { hero: '', story: '', journey: '' }, blocks: defaultAboutBlocks() };
}

// A picture or a video over the top of a shop page (best sellers, packages, auctions...), with the name of the page written on it.
// url empty = no banner: the page keeps its plain heading. The picture of Packages / Auctions is also their tile on the home page.
export type PageKey = 'products' | 'new' | 'best' | 'offers' | 'bundles' | 'auctions';
export const PAGE_KEYS: { id: PageKey; ar: string; en: string }[] = [
  { id: 'products', ar: 'كل المنتجات', en: 'All products' },
  { id: 'new', ar: 'وصل حديثاً', en: 'New arrivals' },
  { id: 'best', ar: 'الأكثر مبيعاً', en: 'Best sellers' },
  { id: 'offers', ar: 'العروض', en: 'Offers' },
  { id: 'bundles', ar: 'الباكجات', en: 'Packages' },
  { id: 'auctions', ar: 'المزادات', en: 'Auctions' },
];
export interface PageBanner { kind: 'image' | 'video'; url: string; posterUrl: string; title: Bi }
export const emptyBanner = (): PageBanner => ({ kind: 'image', url: '', posterUrl: '', title: { ar: '', en: '' } });
export const emptyPages = (): Record<PageKey, PageBanner> => ({ products: emptyBanner(), new: emptyBanner(), best: emptyBanner(), offers: emptyBanner(), bundles: emptyBanner(), auctions: emptyBanner() });

export interface StorefrontCfg {
  // The banner of each shop page
  pages: Record<PageKey, PageBanner>;
  topbar: TopbarCfg;
  hero: HeroCfg;
  about: AboutCfg;
  timeline: TimelineItem[];
  // false (default): the slider pictures are shown exactly as they are. true: a dark layer, zoom and the title go over them
  heroOverlay: boolean;
  strip: StripCfg;
  sections: SectionCfg[];
}

export const SECTION_TYPES: SectionType[] = ['categories', 'new', 'offers', 'best', 'bundles', 'featured', 'features', 'brands', 'video', 'collage'];

const bi = (ar = '', en = ''): Bi => ({ ar, en });
const link = (kind: LinkKind = 'new', value = ''): LinkTarget => ({ kind, value });

export function newSection(type: SectionType, id?: string): SectionCfg {
  return {
    id: id ?? `${type}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    bg: '',
    bgImage: '',
    bgTone: 'dark',
    bgStrength: 55,
    title: bi(),
    subtitle: bi(),
    video: { url: '', posterUrl: '', buttonLabel: bi('تسوق الآن', 'Shop now'), link: link('new') },
    collage: { layout: 'four', images: [] },
  };
}

// A full example of the journey, shown until the owner writes their own (edit or replace it in the dashboard)
export function defaultTimeline(): TimelineItem[] {
  // a simple picture of the year (replace it with a real photo in the dashboard)
  const pic = (year: string, c1: string, c2: string): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="650" cy="90" r="150" fill="#fff" opacity=".08"/><circle cx="120" cy="450" r="190" fill="#fff" opacity=".07"/><text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif" font-size="170" font-weight="900" fill="#fff" opacity=".92">${year}</text></svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  const stop = (year: string, ta: string, te: string, xa: string, xe: string, c1: string, c2: string): TimelineItem => ({ year, title: { ar: ta, en: te }, text: { ar: xa, en: xe }, imageUrl: pic(year, c1, c2), videoUrl: '' });

  return [
    stop('2018', 'الفكرة', 'The idea', 'بدأت الحكاية بفكرة بسيطة: ملابس بجودة عالية وأسلوب سهل يناسب الحياة اليومية، وبسعر عادل.', 'It began with a simple idea: well-made clothes with an easy style that fit everyday life, at a fair price.', '#1f2937', '#4b5563'),
    stop('2019', 'أول مجموعة', 'The first collection', 'أطلقنا أول مجموعة بعدد قليل من القطع، اخترنا كل قطعة منها بعناية وجرّبناها بأنفسنا.', 'We launched our first collection with a handful of pieces, each chosen with care and tested by us.', '#7c2d12', '#ea580c'),
    stop('2020', 'بداية البيع أونلاين', 'Going online', 'فتحنا متجرنا على الإنترنت ليصل إلى كل مكان، وبدأ عملاؤنا يشاركوننا آراءهم وصورهم.', 'We opened our online store so we could reach everywhere, and customers started sharing their thoughts and photos.', '#0f3d3e', '#14b8a6'),
    stop('2022', 'كبر الفريق', 'Growing the team', 'انضم إلينا مصممون ومتخصصو جودة وخدمة عملاء، وصارت كل مجموعة تُصنع بروح فريق كامل.', 'Designers, quality specialists and customer care joined us, and every collection became the work of a whole team.', '#312e81', '#6366f1'),
    stop('2024', 'توصيل أسرع وخدمة أفضل', 'Faster delivery, better service', 'طوّرنا المخازن والشحن ليصل طلبك أسرع، وأضفنا الاستبدال السهل ووسائل دفع متعددة.', 'We upgraded our warehouse and shipping so orders arrive faster, and added easy exchanges and more ways to pay.', '#14532d', '#22c55e'),
    stop('2026', 'اليوم وما بعده', 'Today and beyond', 'نواصل النمو في كل موسم، ونعدك أن نبقى قريبين منك وأن نصنع ما يجعلك تشعر بأفضل حال.', 'We keep growing every season, and we promise to stay close to you and make what helps you feel your best.', '#111111', '#525252'),
  ];
}

export function defaultStorefront(): StorefrontCfg {
  return {
    pages: emptyPages(),
    topbar: {
      enabled: true,
      bg: '#222222',
      color: '#ffffff',
      messages: [bi('شحن مجاني للطلبات فوق 2000 جنيه', 'Free shipping on orders over 2000 EGP'), bi('الدفع عند الاستلام متاح', 'Cash on delivery available')],
    },
    hero: { title: bi('', ''), subtitle: bi('', ''), color: '#ffffff', showButton: false },
    about: defaultAbout(),
    timeline: defaultTimeline(),
    heroOverlay: false,
    strip: {
      enabled: true,
      color: '#222222',
      title: bi('عرض الجمعة السوداء', 'Black Friday offer'),
      columns: [
        { head: bi('اشترِ 1 واحصل على 1 مجاناً', 'Buy 1 get 1 free'), sub: bi('تشكيلة الصيف القديمة', 'Old summer collection'), link: link('offers') },
        { head: bi('خصم يصل إلى 70%', 'Up to 70% off'), sub: bi('تشكيلة الشتاء', 'Winter collection'), link: link('new') },
      ],
      footer: bi('لا تفوّت الفرصة · تسوق الآن', "Don't miss out · Shop now"),
      showCountdown: true,
      endsAt: null,
      link: link('offers'),
    },
    sections: (['categories', 'new', 'offers', 'best', 'bundles', 'featured', 'features', 'brands'] as SectionType[]).map((t) => newSection(t, t)),
  };
}

// Reads the saved text; anything missing falls back to the default so an old or empty value never breaks the page
export function parseStorefront(json: string | null | undefined): StorefrontCfg {
  const base = defaultStorefront();

  if (!json) return base;

  try {
    const raw = JSON.parse(json) as Partial<StorefrontCfg>;
    const old = (raw.strip ?? {}) as Partial<StripCfg>;
    const strip: StripCfg = { ...base.strip, ...old, columns: Array.isArray(old.columns) ? old.columns.map((c) => ({ ...c, link: c.link ?? link('offers') })) : base.strip.columns };
    const sections = Array.isArray(raw.sections) && raw.sections.length > 0
      ? raw.sections.map((s) => ({ ...newSection(s.type ?? 'new', s.id), ...s, video: { ...newSection('video').video, ...(s.video ?? {}) }, collage: { ...newSection('collage').collage, ...(s.collage ?? {}) } }))
      : base.sections;

    const timeline: TimelineItem[] = Array.isArray(raw.timeline)
      ? raw.timeline.map((t) => ({
          year: t.year ?? '',
          imageUrl: t.imageUrl ?? '',
          videoUrl: t.videoUrl ?? '',
          title: { ar: t.title?.ar ?? '', en: t.title?.en ?? '' },
          text: { ar: t.text?.ar ?? '', en: t.text?.en ?? '' },
        }))
      : [];

    const ra = (raw.about ?? {}) as Partial<AboutCfg>;
    const texts: Record<string, Bi> = {};

    for (const f of ABOUT_FIELDS) {
      const v = ra.texts?.[f.key];
      texts[f.key] = { ar: v?.ar ?? '', en: v?.en ?? '' };
    }

    const blocks: AboutBlock[] = Array.isArray(ra.blocks)
      ? ra.blocks
          .filter((b) => b && ABOUT_BLOCK_KINDS.includes(b.kind))
          .map((b) => {
            const d = newAboutBlock(b.kind, b.id);
            const c = (b.custom ?? {}) as Partial<AboutCustom>;

            return {
              ...d,
              enabled: b.enabled !== false,
              bg: b.bg ?? '',
              custom: {
                title: { ar: c.title?.ar ?? '', en: c.title?.en ?? '' },
                text: { ar: c.text?.ar ?? '', en: c.text?.en ?? '' },
                imageUrl: c.imageUrl ?? '',
                layout: c.layout === 'imageEnd' || c.layout === 'textOnly' ? c.layout : 'imageStart',
                buttonLabel: { ar: c.buttonLabel?.ar ?? '', en: c.buttonLabel?.en ?? '' },
                buttonUrl: c.buttonUrl ?? '',
              },
            };
          })
      : defaultAboutBlocks();

    const about: AboutCfg = {
      since: ra.since ?? '',
      texts,
      images: { hero: ra.images?.hero ?? '', story: ra.images?.story ?? '', journey: ra.images?.journey ?? '' },
      blocks,
    };

    const rt = (raw.topbar ?? null) as Partial<TopbarCfg> | null;
    const topbar: TopbarCfg = {
      enabled: rt ? !!rt.enabled : base.topbar.enabled,
      bg: rt?.bg || base.topbar.bg,
      color: rt?.color || base.topbar.color,
      messages: Array.isArray(rt?.messages) ? (rt?.messages ?? []).map((m) => ({ ar: m?.ar ?? '', en: m?.en ?? '' })) : base.topbar.messages,
    };

    const rh = (raw.hero ?? {}) as Partial<HeroCfg>;
    const hero: HeroCfg = {
      title: { ar: rh.title?.ar ?? '', en: rh.title?.en ?? '' },
      subtitle: { ar: rh.subtitle?.ar ?? '', en: rh.subtitle?.en ?? '' },
      color: rh.color || '#ffffff',
      showButton: !!rh.showButton,
    };

    const pages = emptyPages();

    for (const k of Object.keys(pages) as PageKey[]) {
      const p = ((raw.pages ?? {}) as Partial<Record<PageKey, Partial<PageBanner>>>)[k];
      pages[k] = { kind: p?.kind === 'video' ? 'video' : 'image', url: p?.url ?? '', posterUrl: p?.posterUrl ?? '', title: { ar: p?.title?.ar ?? '', en: p?.title?.en ?? '' } };
    }

    return { pages, topbar, hero, about, timeline: timeline.length > 0 ? timeline : defaultTimeline(), heroOverlay: !!raw.heroOverlay, strip, sections };
  } catch {
    return base;
  }
}

// Where a link goes: a router path with its query parameters, or an outside address
export function resolveLink(l: LinkTarget | null | undefined): { url: string; query: Record<string, string | number> | null; external: boolean } {
  switch (l?.kind) {
    case 'new': return { url: '/products', query: { sort: 'newest' }, external: false };
    case 'best': return { url: '/products', query: { sort: 'bestsellers' }, external: false };
    case 'offers': return { url: '/products', query: { onSale: 1 }, external: false };
    case 'bundles': return { url: '/products', query: { bundles: 1 }, external: false };
    case 'category': return { url: '/products', query: { category: l.value }, external: false };
    case 'custom': {
      const v = (l.value ?? '').trim() || '/';
      return { url: v, query: null, external: /^https?:\/\//i.test(v) };
    }
    default: return { url: '/products', query: null, external: false };
  }
}

// Black text on a light colour, white text on a dark one
export function isDarkColor(color: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec((color ?? '').trim());

  if (!m) return false;

  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;

  return lum < 0.55;
}

export function pickText(texts: Bi | null | undefined, lang: string): string {
  return ((lang === 'ar' ? texts?.ar : texts?.en) ?? '').trim() || ((texts?.en ?? texts?.ar) ?? '').trim();
}
