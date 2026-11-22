import './package-editor.i18n';
import { Component, Input, inject } from '@angular/core';
import { I18nService } from '@shared/core/i18n.service';
import { VariantAttribute, VariantInput } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { VariantPickerComponent } from './variant-picker.component';
import { LANGUAGES } from '@shared/core/translation-forms';
import { PRESETS, Preset, PresetValue } from './variant-presets';

interface OptionValue { text: Record<string, string>; colorHex: string; }
// preset: the ready-made list this option was made from ('custom' = the admin types the values)
interface OptionDef { name: Record<string, string>; values: OptionValue[]; preset: string; }

// "Sizes and colours" of a product. The admin defines options (Size: 250 ml, 1 kg ...), presses "Generate variants" and then
// sets the SKU / price / pre-order rules of every combination. A product without options has exactly one variant.
// Quantities are not edited here: they live in the warehouses (Inventory).
@Component({
  selector: 'app-variants-editor',
  standalone: true,
  imports: [TranslatePipe, VariantPickerComponent],
  templateUrl: './variants-editor.component.html',
})
export class VariantsEditorComponent {
  private readonly i18n = inject(I18nService);

  // true: the product is a package (one item made of other items)
  @Input() bundle = false;
  bundleItems: { variantId: number; label: string; quantity: number; price: number | null }[] = [];

  addBundleItem(v: { id: number; productName: string; label: string; price?: number } | null): void {
    if (!v) return;

    const existing = this.bundleItems.find((b) => b.variantId === v.id);

    if (existing) existing.quantity += 1;
    else this.bundleItems.push({ variantId: v.id, label: `${v.productName} ${v.label}`.trim(), quantity: 1, price: v.price ?? null });
  }

  // What the items cost when bought one by one, and a discount in percent turned into the package price
  itemsTotal(): number { return this.round2(this.bundleItems.reduce((t, b) => t + (b.price ?? 0) * (Number(b.quantity) || 0), 0)); }
  round2(n: number): number { return Math.round(n * 100) / 100; }

  applyDiscount(pct: number | null): void {
    if (pct === null || pct < 0 || pct >= 100 || this.itemsTotal() <= 0) return;

    this.rows[0].price = this.round2(this.itemsTotal() * (1 - pct / 100));
    this.rows[0].compareAtPrice = this.itemsTotal();
  }

  readonly languages = LANGUAGES;
  readonly presets = PRESETS;
  readonly lang = this.i18n.lang;
  options: OptionDef[] = [];
  rows: VariantInput[] = [this.blank()];

  text(texts: Record<string, string>, lang: string): string { return texts[lang] || ''; }

  // ---- ready-made options
  presetOf(o: OptionDef): Preset | null { return this.presets.find((p) => p.id === o.preset) ?? null; }
  label(v: PresetValue): string { return this.i18n.lang() === 'ar' ? v.ar : v.en; }
  pickText(texts: Record<string, string>): string { return this.pick(texts); }

  private same(v: OptionValue, p: PresetValue): boolean {
    return (v.text['en'] ?? '').trim().toLowerCase() === p.en.toLowerCase() || (v.text['ar'] ?? '').trim() === p.ar;
  }

  isOn(o: OptionDef, p: PresetValue): boolean { return o.values.some((v) => this.same(v, p)); }

  // Values the admin added that are not in the ready-made list
  extras(o: OptionDef, preset: Preset): OptionValue[] {
    return o.values.filter((v) => Object.values(v.text).some((t) => t?.trim()) && !preset.values.some((p) => this.same(v, p)));
  }

  toggle(o: OptionDef, p: PresetValue): void {
    const i = o.values.findIndex((v) => this.same(v, p));

    if (i >= 0) o.values.splice(i, 1);
    else o.values.push({ text: { en: p.en, ar: p.ar }, colorHex: p.hex ?? '' });

    this.generate();
  }

  removeValue(o: OptionDef, v: OptionValue): void {
    o.values.splice(o.values.indexOf(v), 1);
    this.generate();
  }

  addPreset(p: Preset): void {
    this.options.push({ name: { en: p.name.en, ar: p.name.ar }, values: [], preset: p.id });
  }

  addCustom(): void {
    this.options.push({ name: {}, values: [{ text: {}, colorHex: '' }], preset: 'custom' });
  }

  removeOption(i: number): void {
    this.options.splice(i, 1);
    this.generate();
  }

  addUnitValue(o: OptionDef, p: Preset, amount: HTMLInputElement, unit: HTMLSelectElement): void {
    const n = amount.value.trim();
    const u = p.units?.find((x) => x.en === unit.value);

    if (!n || !u) return;

    const value = { en: `${n} ${u.en}`, ar: `${n} ${u.ar}` };

    if (!this.isOn(o, value)) o.values.push({ text: value, colorHex: '' });
    amount.value = '';
    this.generate();
  }

  addColor(o: OptionDef, en: HTMLInputElement, ar: HTMLInputElement, hex: HTMLInputElement): void {
    const e = en.value.trim();
    const a = ar.value.trim();

    if (!e && !a) return;

    o.values.push({ text: { en: e || a, ar: a || e }, colorHex: hex.value });
    en.value = '';
    ar.value = '';
    this.generate();
  }

  addFree(o: OptionDef, input: HTMLInputElement): void {
    const t = input.value.trim();

    if (!t) return;

    if (!o.values.some((v) => v.text['en'] === t)) o.values.push({ text: { en: t, ar: t }, colorHex: '' });
    input.value = '';
    this.generate();
  }

  txt(e: Event): string { return (e.target as HTMLInputElement).value; }
  chk(e: Event): boolean { return (e.target as HTMLInputElement).checked; }
  // A barcode typed in the table: empty = none (the system makes one on save)
  codeOf(e: Event): string | null { return (e.target as HTMLInputElement).value.trim() || null; }
  num(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value;
    return v === '' ? null : Number(v);
  }

  // Loads the variants of a product and rebuilds the option lists from them
  setValue(variants: VariantInput[]): void {
    this.rows = variants.length ? variants.map((v) => ({ ...v, attributes: v.attributes.map((a) => ({ ...a })) })) : [this.blank()];

    this.bundleItems = (this.rows[0]?.bundleItems ?? []).map((b) => ({ variantId: b.variantId, label: b.label || `#${b.variantId}`, quantity: b.quantity, price: (b as { unitPrice?: number | null }).unitPrice ?? null }));

    const count = Math.max(0, ...this.rows.map((r) => r.attributes.length));
    const options: OptionDef[] = [];

    for (let i = 0; i < count; i++) {
      const first = this.rows.find((r) => r.attributes[i])?.attributes[i];
      const seen = new Set<string>();
      const name = { ...(first?.name ?? {}) };
      const option: OptionDef = { name, values: [], preset: PRESETS.find((p) => p.name.en.toLowerCase() === (name['en'] ?? '').trim().toLowerCase() || p.name.ar === (name['ar'] ?? '').trim())?.id ?? 'custom' };

      for (const r of this.rows) {
        const a = r.attributes[i];
        if (!a || seen.has(JSON.stringify(a.value))) continue;
        seen.add(JSON.stringify(a.value));
        option.values.push({ text: { ...a.value }, colorHex: a.colorHex ?? '' });
      }

      options.push(option);
    }

    this.options = options;
  }

  // A single empty default row means "not sold online" (catalogue product: customers can only request a quote)
  private notSold(): boolean {
    return this.rows.length === 1 && this.rows[0].attributes.length === 0 && !(this.rows[0].price > 0);
  }

  // Null when everything is fine, otherwise the translation key of the problem
  validate(): string | null {
    if (this.bundle) {
      if (!(this.rows[0]?.price > 0)) return 'inv.var.errPrice';
      return this.bundleItems.length === 0 ? 'bundle.errItems' : null;
    }

    if (this.notSold()) return null;
    if (this.rows.some((r) => !(r.price > 0))) return 'inv.var.errPrice';
    if (this.rows.some((r) => r.compareAtPrice !== null && r.compareAtPrice <= r.price)) return 'inv.var.errCompare';
    return null;
  }

  getValue(): VariantInput[] {
    // A package: one item with its price and its components
    if (this.bundle) {
      const r = this.rows[0] ?? this.blank();

      return [{
        ...r,
        attributes: [],
        sku: r.sku?.trim() || null,
        barcode: r.barcode?.trim() || null,
        price: Number(r.price) || 0,
        compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice) : null,
        trackStock: true,
        allowPreorder: false,
        preorderLeadDays: null,
        sortOrder: 1,
        bundleItems: this.bundleItems.map((b) => ({ variantId: b.variantId, quantity: Number(b.quantity) || 1 })),
      }];
    }

    if (this.notSold()) return [];

    return this.rows.map((r, i) => ({
      ...r,
      sku: r.sku?.trim() || null,
      barcode: r.barcode?.trim() || null,
      price: Number(r.price) || 0,
      compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice) : null,
      preorderLeadDays: r.allowPreorder ? r.preorderLeadDays : null,
      lowStockThreshold: Number(r.lowStockThreshold) || 0,
      sortOrder: i + 1,
    }));
  }

  labelOf(r: VariantInput): string {
    return r.attributes.map((a) => this.pick(a.value)).filter(Boolean).join(' / ');
  }

  // Builds one variant for every combination of the option values. Rows that already exist keep their id, SKU and price.
  generate(): void {
    const usable = this.options
      .map((o) => ({ ...o, values: o.values.filter((v) => Object.values(v.text).some((t) => t?.trim())) }))
      .filter((o) => Object.values(o.name).some((n) => n?.trim()) && o.values.length > 0);

    if (usable.length === 0) {
      // No options: a simple product with one variant
      const keep = this.rows[0] ?? this.blank();
      this.rows = [{ ...keep, attributes: [] }];
      return;
    }

    const price = this.rows[0]?.price ?? 0;
    let combos: VariantAttribute[][] = [[]];

    for (const o of usable) {
      combos = combos.flatMap((prefix) =>
        o.values.map((v) => [...prefix, { name: this.clean(o.name), value: this.clean(v.text), colorHex: v.colorHex && v.colorHex !== '#cccccc' ? v.colorHex : null }]),
      );
    }

    const key = (attrs: VariantAttribute[]): string => JSON.stringify(attrs.map((a) => a.value));
    const existing = new Map(this.rows.map((r) => [key(r.attributes), r]));

    this.rows = combos.map((attributes) => {
      const match = existing.get(key(attributes));
      return match ? { ...match, attributes } : { ...this.blank(), price, attributes };
    });
  }

  private clean(texts: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(texts).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v.trim()]));
  }

  private pick(texts: Record<string, string>): string {
    return texts[this.i18n.lang()] || Object.values(texts).find((t) => t) || '';
  }

  private blank(): VariantInput {
    return { id: null, sku: null, price: 0, compareAtPrice: null, isActive: true, trackStock: true, allowPreorder: false, preorderLeadDays: null, imageUrl: null, sortOrder: 0, attributes: [], lowStockThreshold: 0 };
  }
}