import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The texts of the card payment (Stripe): the page the customer returns to after paying or leaving the payment page.
const en: Record<string, string> = {
  'pay.redirecting': 'Taking you to the secure payment page…',
  'pay.received': 'Payment received. We are confirming it now, this page updates by itself.',
  'pay.cancelled': 'The payment was not completed. Your order is saved: you can pay again.',
  'pay.again': 'Pay again',
  'pay.unavailable': 'Card payment is not available right now. Your order is saved; we will contact you.',
  'pay.waiting': 'Waiting for the payment',
};

const ar: Record<string, string> = {
  'pay.redirecting': 'جارٍ تحويلك إلى صفحة الدفع الآمنة…',
  'pay.received': 'تم استلام الدفع. نؤكده الآن وستتحدث هذه الصفحة تلقائياً.',
  'pay.cancelled': 'لم تكتمل عملية الدفع. طلبك محفوظ ويمكنك الدفع مرة أخرى.',
  'pay.again': 'ادفع مرة أخرى',
  'pay.unavailable': 'الدفع بالبطاقة غير متاح حالياً. طلبك محفوظ وسنتواصل معك.',
  'pay.waiting': 'في انتظار الدفع',
};

Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);
