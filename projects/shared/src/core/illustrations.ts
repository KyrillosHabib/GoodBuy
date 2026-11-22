// The website ships its own vector illustrations (src/assets/illustrations).
// They are used when a product / category / the company has no real photo yet,
// and when the stored image is only a random placeholder (e.g. picsum.photos).
const BASE = 'assets/illustrations';

export type Illustration = 'hero' | 'about' | 'default';

export const ILLUSTRATIONS: Record<Illustration, string> = {
  hero: `${BASE}/hero.svg`,
  about: `${BASE}/about.svg`,
  default: `${BASE}/default.svg`,
};

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  return !url || !url.trim() || /picsum\.photos|placehold|placeholder|dummyimage|lorempixel/i.test(url);
}

// Picks the illustration that matches the product (by keywords in its slug), then by its category.
export function productIllustration(slug: string | null | undefined, categorySlug?: string | null): string {
  const s = (slug ?? '').toLowerCase();
  const c = (categorySlug ?? '').toLowerCase();

  if (/fryer/.test(s)) return `${BASE}/air-fryer.svg`;
  if (/microwave/.test(s)) return `${BASE}/microwave.svg`;
  if (/heater|radiator/.test(s)) return `${BASE}/heater.svg`;
  if (/dryer|tumble/.test(s)) return `${BASE}/dryer.svg`;
  if (/washer|washing/.test(s)) return `${BASE}/washer.svg`;
  if (/split|conditioner|(^|-)ac(-|$)|air-con/.test(s)) return `${BASE}/split-ac.svg`;

  if (/kitchen/.test(c)) return `${BASE}/air-fryer.svg`;
  if (/cool|heat|air/.test(c)) return `${BASE}/split-ac.svg`;
  if (/laundry|wash/.test(c)) return `${BASE}/washer.svg`;

  return ILLUSTRATIONS.default;
}

export function categoryIllustration(slug: string | null | undefined): string {
  const s = (slug ?? '').toLowerCase();

  if (/kitchen/.test(s)) return `${BASE}/category-kitchen.svg`;
  if (/cool|heat|air/.test(s)) return `${BASE}/category-cooling.svg`;
  if (/laundry|wash/.test(s)) return `${BASE}/category-laundry.svg`;

  return ILLUSTRATIONS.default;
}
