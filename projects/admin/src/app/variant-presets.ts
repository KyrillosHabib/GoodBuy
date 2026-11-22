// Ready-made options for a product: the admin ticks colours / sizes instead of typing them (and no colour codes).
export interface PresetValue { en: string; ar: string; hex?: string; }

export interface Preset {
  id: string;
  name: { en: string; ar: string };
  // color: swatches · unit: a number + a unit (ml, g, cm ...) · free: any text
  kind: 'color' | 'unit' | 'free';
  values: PresetValue[];
  units?: { en: string; ar: string }[];
}

const units = (list: number[], u: { en: string; ar: string }): PresetValue[] => list.map((n) => ({ en: `${n} ${u.en}`, ar: `${n} ${u.ar}` }));

export const PRESETS: Preset[] = [
  {
    id: 'color',
    name: { en: 'Color', ar: 'اللون' },
    kind: 'color',
    values: [
      { en: 'Black', ar: 'أسود', hex: '#111111' },
      { en: 'White', ar: 'أبيض', hex: '#ffffff' },
      { en: 'Gray', ar: 'رمادي', hex: '#9ca3af' },
      { en: 'Silver', ar: 'فضي', hex: '#c0c0c0' },
      { en: 'Gold', ar: 'ذهبي', hex: '#d4af37' },
      { en: 'Red', ar: 'أحمر', hex: '#dc2626' },
      { en: 'Pink', ar: 'وردي', hex: '#ec4899' },
      { en: 'Orange', ar: 'برتقالي', hex: '#f97316' },
      { en: 'Yellow', ar: 'أصفر', hex: '#facc15' },
      { en: 'Green', ar: 'أخضر', hex: '#16a34a' },
      { en: 'Blue', ar: 'أزرق', hex: '#2563eb' },
      { en: 'Navy', ar: 'كحلي', hex: '#1e3a8a' },
      { en: 'Purple', ar: 'بنفسجي', hex: '#7c3aed' },
      { en: 'Brown', ar: 'بني', hex: '#78350f' },
      { en: 'Beige', ar: 'بيج', hex: '#d6c3a1' },
    ],
  },
  {
    id: 'volume',
    name: { en: 'Volume', ar: 'الحجم (سوائل)' },
    kind: 'unit',
    units: [{ en: 'ml', ar: 'مل' }, { en: 'L', ar: 'لتر' }],
    values: [...units([30, 50, 100, 125, 200, 250, 330, 500, 750], { en: 'ml', ar: 'مل' }), ...units([1, 1.5, 2, 5], { en: 'L', ar: 'لتر' })],
  },
  {
    id: 'weight',
    name: { en: 'Weight', ar: 'الوزن' },
    kind: 'unit',
    units: [{ en: 'g', ar: 'جرام' }, { en: 'kg', ar: 'كجم' }],
    values: [...units([50, 100, 250, 500], { en: 'g', ar: 'جرام' }), ...units([1, 2, 5, 10, 25], { en: 'kg', ar: 'كجم' })],
  },
  {
    id: 'length',
    name: { en: 'Length', ar: 'الطول' },
    kind: 'unit',
    units: [{ en: 'cm', ar: 'سم' }, { en: 'm', ar: 'متر' }],
    values: [...units([10, 20, 30, 50, 75], { en: 'cm', ar: 'سم' }), ...units([1, 1.5, 2, 3, 5, 10], { en: 'm', ar: 'متر' })],
  },
  {
    id: 'clothing',
    name: { en: 'Size', ar: 'المقاس' },
    kind: 'free',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map((s) => ({ en: s, ar: s })),
  },
  {
    id: 'shoe',
    name: { en: 'Shoe size', ar: 'مقاس الحذاء' },
    kind: 'free',
    values: Array.from({ length: 11 }, (_, i) => String(36 + i)).map((s) => ({ en: s, ar: s })),
  },
  {
    id: 'pack',
    name: { en: 'Pack', ar: 'العبوة' },
    kind: 'unit',
    units: [{ en: 'pcs', ar: 'قطعة' }],
    values: units([1, 2, 3, 6, 12, 24, 50, 100], { en: 'pcs', ar: 'قطعة' }),
  },
];
