import { DICTIONARY } from '@shared/core/i18n.dictionary';
import type { OrderEvent } from './order-ops.api';

// The timeline of an order is written by the API in English ("Status: Processing -> Shipped."). In Arabic the lines are
// translated here: each known sentence has a pattern; names and numbers inside it (products, warehouses, amounts) are kept.
// A line that matches nothing (a note a person typed, a future message) is shown as it is.

type Dict = Record<string, string>;

function word(lang: string, key: string, fallback: string): string {
  const d = (DICTIONARY as unknown as Record<string, Dict>)[lang];

  return d?.[key] ?? fallback;
}

const orderStatus = (lang: string, s: string): string => word(lang, 'order.status.' + s, s);
const payStatus = (lang: string, s: string): string => word(lang, 'ord.pay.' + s, s);
const payMethod = (lang: string, s: string): string => word(lang, 'pay.' + s, s);

interface Rule {
  re: RegExp;
  ar: (m: RegExpMatchArray, lang: string) => string;
}

// "Payment status: Unpaid -> Paid." (the tail some payment lines carry)
const PAY_TAIL = String.raw`(?: Payment status: (\w+) -> (\w+)\.)?`;

const RULES: Rule[] = [
  {
    re: /^Order placed \((\w+)\), total ([\d.,]+) (\S+)\.$/,
    ar: (m, l) => `تم إنشاء الطلب (${payMethod(l, m[1])}) بإجمالي ${m[2]} ${m[3]}.`,
  },
  {
    re: /^Status: (\w+) -> (\w+)\. Handed over to (.+)\.$/,
    ar: (m, l) => `تغيرت الحالة من «${orderStatus(l, m[1])}» إلى «${orderStatus(l, m[2])}». سُلّم الطلب إلى ${m[3]}.`,
  },
  {
    re: /^Status: (\w+) -> (\w+)\.$/,
    ar: (m, l) => `تغيرت الحالة من «${orderStatus(l, m[1])}» إلى «${orderStatus(l, m[2])}».`,
  },
  {
    re: /^Status: Processing \(the warehouse started\)\.$/,
    ar: (_m, l) => `بدأ المخزن العمل على الطلب، والحالة الآن «${orderStatus(l, 'Processing')}».`,
  },
  {
    re: /^Shipping: (?:no company|company #(\d+))(?:, tracking (.+))?\.$/,
    ar: (m) => `بيانات الشحن:${m[1] ? ' شركة رقم ' + m[1] : ' بدون شركة'}${m[2] ? '، رقم التتبع ' + m[2] : ''}.`,
  },
  {
    re: /^(.+) x(\d+) given to (.+)\.$/,
    ar: (m) => `خُصّص ${m[1]} × ${m[2]} للمخزن «${m[3]}».`,
  },
  {
    re: /^(.+) x(\d+): preparing\.$/,
    ar: (m) => `بدأ تجهيز ${m[1]} × ${m[2]}.`,
  },
  {
    re: /^(.+): problem - ([\s\S]*)$/,
    ar: (m) => `مشكلة في ${m[1]}: ${m[2]}`,
  },
  {
    re: /^(.+) x(\d+) left the warehouse\.$/,
    ar: (m) => `خرج ${m[1]} × ${m[2]} من المخزن.`,
  },
  {
    re: new RegExp(String.raw`^Payment received: ([\d.,]+) (\S+?)\.?${PAY_TAIL}$`),
    ar: (m, l) => `تم استلام دفعة ${m[1]} ${m[2]}.${m[3] ? ` حالة الدفع: «${payStatus(l, m[3])}» ← «${payStatus(l, m[4])}».` : ''}`,
  },
  {
    re: new RegExp(String.raw`^Refund given: ([\d.,]+) (\S+?)\.?${PAY_TAIL}$`),
    ar: (m, l) => `تم رد مبلغ ${m[1]} ${m[2]} للعميل.${m[3] ? ` حالة الدفع: «${payStatus(l, m[3])}» ← «${payStatus(l, m[4])}».` : ''}`,
  },
  {
    re: new RegExp(String.raw`^A payment attempt failed\.?${PAY_TAIL}$`),
    ar: (m, l) => `فشلت محاولة دفع.${m[1] ? ` حالة الدفع: «${payStatus(l, m[1])}» ← «${payStatus(l, m[2])}».` : ''}`,
  },
  {
    re: /^Cash on delivery settled with (.+) \((.+)\): ([\d.,]+) (\S+)\. Payment status: (\w+) -> (\w+)\.$/,
    ar: (m, l) => `تمت تسوية الدفع عند الاستلام مع ${m[1]} (${m[2]}) بمبلغ ${m[3]} ${m[4]}. حالة الدفع: «${payStatus(l, m[5])}» ← «${payStatus(l, m[6])}».`,
  },
  {
    re: /^The settlement (.+) was reversed: the cash is with the shipping company again\. Payment status: (\w+) -> (\w+)\.$/,
    ar: (m, l) => `أُلغيت التسوية ${m[1]}: عاد المبلغ إلى عهدة شركة الشحن. حالة الدفع: «${payStatus(l, m[2])}» ← «${payStatus(l, m[3])}».`,
  },
  {
    re: /^Stripe reported (\S+) (\S+) \((.+)\), but the order asks (\S+) (\S+)\. Not recorded: check it in Stripe\.$/,
    ar: (m) => `أبلغت Stripe عن مبلغ ${m[1]} ${m[2]} (${m[3]}) بينما الطلب يطلب ${m[4]} ${m[5]}. لم يُسجَّل المبلغ: راجعه في Stripe.`,
  },
  {
    re: /^The payout of the gateway reached the bank(?: \((.+)\))?\.$/,
    ar: (m) => `وصل تحويل بوابة الدفع إلى البنك${m[1] ? ' (' + m[1] + ')' : ''}.`,
  },
  {
    re: /^Return (\S+) requested \((\d+) units\)\.$/,
    ar: (m) => `طُلب المرتجع ${m[1]} (${m[2]} وحدة).`,
  },
  {
    re: /^Return (\S+) received by the warehouse\.$/,
    ar: (m) => `استلم المخزن المرتجع ${m[1]}.`,
  },
  {
    re: /^Return (\S+) checked: all good\.$/,
    ar: (m) => `تم فحص المرتجع ${m[1]}: كل شيء سليم.`,
  },
  {
    re: /^Return (\S+) checked: waits for the head of the warehouse\.$/,
    ar: (m) => `تم فحص المرتجع ${m[1]}: بانتظار رئيس المخزن.`,
  },
  {
    re: /^Return (\S+) approved\.$/,
    ar: (m) => `اعتُمد المرتجع ${m[1]}.`,
  },
  {
    re: /^Return (\S+) sent back to be checked again: ([\s\S]*)$/,
    ar: (m) => `أُعيد المرتجع ${m[1]} للفحص من جديد: ${m[2]}`,
  },
  {
    re: /^Return (\S+) cancelled\.$/,
    ar: (m) => `أُلغي المرتجع ${m[1]}.`,
  },
  {
    re: /^Return (\S+): some goods are isolated until the head decides\.$/,
    ar: (m) => `المرتجع ${m[1]}: بعض البضاعة معزولة حتى يقرر رئيس المخزن.`,
  },
  {
    re: /^Return (\S+) completed\.$/,
    ar: (m) => `اكتمل المرتجع ${m[1]}.`,
  },
];

export function translateEvent(message: string, lang: string): string {
  if (lang !== 'ar') return message;

  for (const rule of RULES) {
    const m = message.match(rule.re);

    if (m) return rule.ar(m, lang);
  }

  return message;
}

// Lines that only repeat what a status line says (one line per product while the warehouse works, the shipping fields) are left out.
const NOISE = new Set(['allocated', 'picking', 'shipping']);

export function visibleEvents(events: OrderEvent[] | undefined | null): OrderEvent[] {
  return (events ?? []).filter((e) => !NOISE.has(e.type));
}

// "2026-11-12 09:37" in the time of the browser (the API sends UTC without a zone mark)
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '';

  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z');

  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');

  const p = (n: number): string => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
