import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The package screen: first the items inside it, then its price and its discount
Object.assign(DICTIONARY.en, {
  'step.package': 'Items and price',
  'pkg.intro': 'A package sells several items together at one price. 1) Press "New package" and write its name, description and images. 2) In the last step add the items inside it and their quantities. 3) Set the package price, or type a discount percentage and the price is calculated for you.',
  'bundle.stepItems': 'Search the items that are sold together. Click the box to see the items, or type any part of the name.',
  'bundle.unit': 'Item price',
  'bundle.line': 'Total',
  'bundle.stepPrice': 'Price and discount',
  'bundle.priceHint': 'Write the package price yourself, or type a discount percentage on the total of its items and the price is filled in.',
  'bundle.total': 'Price of the items when sold separately',
  'bundle.price': 'Package price',
  'bundle.discPct': 'Discount % on the total',
  'bundle.discPh': 'e.g. 10',
  'bundle.useTotalAsOld': 'Show the items total as the old (crossed-out) price',
  'bundle.saving': 'The customer saves',
  'bundle.noSaving': 'The package price is not lower than the items total, so the customer saves nothing.',
});

Object.assign(DICTIONARY.ar, {
  'step.package': 'المنتجات والسعر',
  'pkg.intro': 'الباكج يبيع عدة منتجات معاً بسعر واحد. 1) اضغط «باكج جديد» واكتب اسمه ووصفه وصوره. 2) في الخطوة الأخيرة أضف المنتجات التي بداخله وكمية كل منها. 3) حدّد سعر الباكج، أو اكتب نسبة الخصم فيُحسب السعر تلقائياً.',
  'bundle.stepItems': 'ابحث عن المنتجات التي تُباع معاً. اضغط على الخانة لعرض المنتجات، أو اكتب أي جزء من الاسم.',
  'bundle.unit': 'سعر المنتج',
  'bundle.line': 'الإجمالي',
  'bundle.stepPrice': 'السعر والخصم',
  'bundle.priceHint': 'اكتب سعر الباكج بنفسك، أو اكتب نسبة خصم على مجموع أسعار منتجاته فيُعبّأ السعر تلقائياً.',
  'bundle.total': 'سعر المنتجات إذا بيعت منفردة',
  'bundle.price': 'سعر الباكج',
  'bundle.discPct': 'نسبة الخصم على المجموع %',
  'bundle.discPh': 'مثال: 10',
  'bundle.useTotalAsOld': 'إظهار مجموع المنتجات كسعر قديم (مشطوب)',
  'bundle.saving': 'يوفّر العميل',
  'bundle.noSaving': 'سعر الباكج ليس أقل من مجموع منتجاته، فلا يوفّر العميل شيئاً.',
});
