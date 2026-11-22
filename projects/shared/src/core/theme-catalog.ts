// Business categories. The storefront is WHITE with a BLACK header and footer whatever the business; what the business changes is ONE
// identity color (what a button turns into on hover, links, small details: gold for perfumes, blue for technology ...) and the
// color of offers (red). Every category has 3 shades of its identity color (original, soft, deep) and each color can still be edited.
//
// colors: [identity, soft tint, offer, white, black]

export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  darkColor: string;
}

export interface BusinessCategory {
  id: string;
  en: string;
  ar: string;
  // [identity, soft tint, offer, white, black]
  colors: [string, string, string, string, string];
}

const OFFER = '#D62828';

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { id: 'beauty', en: 'Skincare & Beauty', ar: 'الصحة والعناية بالبشرة والتجميل', colors: ['#B7794F', '#F3E6DC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'medical', en: 'Healthcare & Medical', ar: 'المستشفيات والعيادات والخدمات الطبية', colors: ['#167D9A', '#DDF0F5', OFFER, '#FFFFFF', '#111111'] },
  { id: 'luxury', en: 'Luxury & Perfumes', ar: 'العطور والمنتجات الفاخرة', colors: ['#B8923A', '#F5ECD8', OFFER, '#FFFFFF', '#111111'] },
  { id: 'wellness', en: 'Wellness & Natural Care', ar: 'الصحة العامة والعناية الطبيعية', colors: ['#557153', '#E4ECE2', OFFER, '#FFFFFF', '#111111'] },
  { id: 'football', en: 'Football & Sports Clubs', ar: 'كرة القدم والأندية الرياضية', colors: ['#2F9E44', '#E1F3E5', OFFER, '#FFFFFF', '#111111'] },
  { id: 'gym', en: 'Fitness & Gym', ar: 'الجيم واللياقة البدنية', colors: ['#F26B2C', '#FDE8DC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'tech', en: 'Technology & Electronics', ar: 'التكنولوجيا والإلكترونيات', colors: ['#1F6FEB', '#DFEAFC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'fashion', en: 'Fashion & Apparel', ar: 'الملابس والأزياء', colors: ['#8C6F52', '#EFE7DE', OFFER, '#FFFFFF', '#111111'] },
  { id: 'trade', en: 'Import, Export & Trade', ar: 'الاستيراد والتصدير والتجارة الدولية', colors: ['#2F6690', '#DFE9F1', OFFER, '#FFFFFF', '#111111'] },
  { id: 'industrial', en: 'Manufacturing & Industrial', ar: 'المصانع والصناعة والمعدات', colors: ['#E08A1E', '#FBEBD4', OFFER, '#FFFFFF', '#111111'] },
  { id: 'corporate', en: 'Corporate & Professional Services', ar: 'الشركات التجارية والاستشارات والخدمات المالية', colors: ['#2B5BA8', '#E0E8F4', OFFER, '#FFFFFF', '#111111'] },
  { id: 'logistics', en: 'Logistics & Transportation', ar: 'الشحن والنقل والخدمات اللوجستية', colors: ['#E4572E', '#FBE4DC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'agriculture', en: 'Agriculture & Fresh Produce', ar: 'المنتجات الزراعية والتصدير الزراعي', colors: ['#3E8E41', '#E0F0E1', OFFER, '#FFFFFF', '#111111'] },
  { id: 'food', en: 'Food & Beverage', ar: 'الأغذية والمشروبات والمصنعات الغذائية', colors: ['#E8742B', '#FCE9DC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'realestate', en: 'Real Estate & Development', ar: 'العقارات والتطوير العقاري', colors: ['#A8864F', '#F1EADC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'women', en: "Women's Beauty & Care", ar: 'جمال المرأة والعناية', colors: ['#C2507E', '#F9E3EC', OFFER, '#FFFFFF', '#111111'] },
  { id: 'kids', en: 'Kids & Baby', ar: 'الأطفال والرُّضَّع', colors: ['#E07A5F', '#FBE6E0', OFFER, '#FFFFFF', '#111111'] },
  { id: 'hospitality', en: 'Travel, Hospitality & Restaurants', ar: 'السياحة والفنادق والمطاعم', colors: ['#2C8C84', '#DDF0EE', OFFER, '#FFFFFF', '#111111'] },
];

export const PALETTE_VARIANTS = ['original', 'soft', 'deep'] as const;
export type PaletteVariant = (typeof PALETTE_VARIANTS)[number];

// ---------- color math (hex <-> HSL, contrast) ----------

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, l];

  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;

  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];

  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Lighter (+) or darker (-) by a part of the lightness scale: 0.1 = 10 points
export function shade(hex: string, delta: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));

  return rgbToHex(hslToRgb([h, s, Math.min(0.97, Math.max(0.05, l + delta))]));
}

function blend(a: string, b: string, amount: number): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];

  return rgbToHex([x[0] + (y[0] - x[0]) * amount, x[1] + (y[1] - x[1]) * amount, x[2] + (y[2] - x[2]) * amount]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [Math.max(luminance(a), luminance(b)), Math.min(luminance(a), luminance(b))];

  return (hi + 0.05) / (lo + 0.05);
}

// The colors of a category in one of its 3 shades.
// A palette whose last color is white (a light text for dark surfaces) cannot be the TEXT of a light page: then the
// text becomes the darkest color of the palette, so the site stays readable.
// The storefront rule: the page is white, the text is black, the dark surface (header, footer) is black, the ACCENT is the color of
// offers (red) and the PRIMARY is the identity color. Nothing else is dark or colored.
export function storefront(theme: ThemeColors): ThemeColors {
  return { ...theme, backgroundColor: '#ffffff', textColor: '#111111', darkColor: '#0a0a0a', secondaryColor: blend(theme.primaryColor, '#ffffff', 0.86) };
}

// The colors of a category in one of its 3 shades (the shade moves the identity color only)
export function buildTheme(category: BusinessCategory, variant: PaletteVariant): ThemeColors {
  let [primary, , offer] = category.colors;

  if (variant === 'soft') primary = shade(primary, 0.08);
  else if (variant === 'deep') primary = shade(primary, -0.1);

  // The identity color carries the label of a hovered button: a very light color would lose it (large bold text needs 3:1)
  while (contrast('#ffffff', primary) < 3 && contrast('#111111', primary) < 4.5 && luminance(primary) > 0.02) primary = shade(primary, -0.01);

  return storefront({ primaryColor: primary, secondaryColor: '', accentColor: offer, backgroundColor: '#ffffff', textColor: '#111111', darkColor: '#0a0a0a' });
}

// "Lighter" / "darker" buttons: the three identity colors move together (the background and the text keep their job)
export function shiftTheme(theme: ThemeColors, delta: number): Pick<ThemeColors, 'primaryColor' | 'secondaryColor' | 'accentColor'> {
  return { primaryColor: shade(theme.primaryColor, delta), secondaryColor: shade(theme.secondaryColor, delta), accentColor: shade(theme.accentColor, delta) };
}

// A theme from only THREE colors the owner really chooses (the main color, the highlight and the background).
// The rest follows by itself, so the screen stays calm: a soft tint of the main color for surfaces, a very dark tone of it for
// text and for the dark parts, with the text kept readable.
export function deriveTheme(primary: string, accent: string, _background: string): ThemeColors {
  return storefront({ primaryColor: primary, secondaryColor: '', accentColor: accent, backgroundColor: '#ffffff', textColor: '#111111', darkColor: '#0a0a0a' });
}
