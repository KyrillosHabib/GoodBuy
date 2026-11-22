import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The shop's home page: product rows, the offer and its countdown, the About page.
const en: Record<string, string> = {
  'home.new': 'New Arrivals',
  'home.best': 'Best Sellers',
  'home.offers': 'Offers',
  'home.bundles': 'Packages',
  'offer.limited': 'Limited-time offer',
  'offer.endsIn': 'Offer ends in',
  'offer.shop': 'Shop the offer',
  'offer.days': 'Days',
  'offer.hours': 'Hours',
  'offer.minutes': 'Minutes',
  'offer.seconds': 'Seconds',
  'nav.new': 'New',
  'nav.offers': 'Offers',
  'nav.bundles': 'Packages',
  'shop.filterSort': 'Filter and sort',
  'shop.apply': 'Apply',
  'pd.qty': 'Quantity',
  'pd.payMethods': 'Accepted payment methods',
  'pd.cod': 'Cash on delivery',
  'pd.shipReturn': 'Delivery and returns',
  'pd.shipReturnText': 'We deliver to your door and you can return or exchange an item within the return period.',
};
const ar: Record<string, string> = {
  'home.new': 'وصل حديثاً',
  'home.best': 'الأكثر مبيعاً',
  'home.offers': 'العروض',
  'home.bundles': 'الباكجات',
  'offer.limited': 'عرض لفترة محدودة',
  'offer.endsIn': 'ينتهي العرض بعد',
  'offer.shop': 'تسوّق العرض',
  'offer.days': 'يوم',
  'offer.hours': 'ساعة',
  'offer.minutes': 'دقيقة',
  'offer.seconds': 'ثانية',
  'nav.new': 'جديد',
  'nav.offers': 'العروض',
  'nav.bundles': 'الباكجات',
  'shop.filterSort': 'التصفية والترتيب',
  'shop.apply': 'تطبيق',
  'pd.qty': 'الكمية',
  'pd.payMethods': 'وسائل الدفع المتاحة',
  'pd.cod': 'الدفع عند الاستلام',
  'pd.shipReturn': 'التوصيل والاسترجاع',
  'pd.shipReturnText': 'نوصّل لباب بيتك، ويمكنك استرجاع أو استبدال المنتج خلال فترة الاسترجاع.',
};
Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);

// ---- round 23: quick view, menu, strip, new sections
Object.assign(DICTIONARY.en, {
  'qv.show': 'Show options', 'qv.subtotal': 'Product subtotal', 'qv.wish': 'Add to favourites', 'nav.best': 'Best sellers',
  'home.shopNow': 'SHOP NOW', 'home.startFrom': 'START FROM', 'home.upTo': 'UP TO', 'home.off': 'OFF', 'home.catTitle': 'Shop by category', 'home.catText': 'Pick what suits you',
});
Object.assign(DICTIONARY.ar, {
  'qv.show': 'عرض الخيارات', 'qv.subtotal': 'إجمالي المنتج', 'qv.wish': 'أضف للمفضلة', 'nav.best': 'الأكثر مبيعاً',
  'home.shopNow': 'تسوق الآن', 'home.startFrom': 'ابتداءً من', 'home.upTo': 'خصم حتى', 'home.off': '', 'home.catTitle': 'تسوق حسب القسم', 'home.catText': 'اختر ما يناسبك',
});

Object.assign(DICTIONARY.en, { 'product.sale': 'Sale' });
Object.assign(DICTIONARY.ar, { 'product.sale': 'خصم' });

Object.assign(DICTIONARY.en, { 'shop.all': 'All', 'shop.sortBy': 'Sort by', 'shop.filter': 'Filter', 'shop.collections': 'Collections', 'shop.sortNameAsc': 'Name: A to Z', 'shop.sortNameDesc': 'Name: Z to A' });
Object.assign(DICTIONARY.ar, { 'shop.all': 'الكل', 'shop.sortBy': 'ترتيب حسب', 'shop.filter': 'فلتر', 'shop.collections': 'المجموعات', 'shop.sortNameAsc': 'الاسم: من أ إلى ي', 'shop.sortNameDesc': 'الاسم: من ي إلى أ' });

Object.assign(DICTIONARY.en, { 'about.journey': 'Our journey' });
Object.assign(DICTIONARY.ar, { 'about.journey': 'رحلتنا' });

Object.assign(DICTIONARY.en, { 'shop.back': 'Back' });
Object.assign(DICTIONARY.ar, { 'shop.back': 'رجوع' });

Object.assign(DICTIONARY.en, { 'about.story': 'Our story', 'about.values': 'What we believe in' });
Object.assign(DICTIONARY.ar, { 'about.story': 'قصتنا', 'about.values': 'ما نؤمن به' });

Object.assign(DICTIONARY.en, { 'about.est': 'EST.', 'about.since': 'Since', 'about.now': 'Now' });
Object.assign(DICTIONARY.ar, { 'about.est': 'تأسست', 'about.since': 'منذ', 'about.now': 'الآن' });

Object.assign(DICTIONARY.en, { 'about.why': 'What sets us apart', 'about.journeyLabel': 'Our journey' });
Object.assign(DICTIONARY.ar, { 'about.why': 'ما يميزنا', 'about.journeyLabel': 'رحلتنا' });

Object.assign(DICTIONARY.en, { 'review.none': 'No reviews yet.' });
Object.assign(DICTIONARY.ar, { 'review.none': 'لا توجد تقييمات بعد.' });
