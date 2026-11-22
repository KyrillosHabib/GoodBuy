import { DICTIONARY } from '@shared/core/i18n.dictionary';

// Reconciliation of the customer / supplier accounts (control accounts against the balances of the parties).
const en: Record<string, string> = {
  'acc.rec2.title': 'Customers and suppliers against the books',
  'acc.rec2.customers': 'Customers (receivable account)',
  'acc.rec2.suppliers': 'Suppliers (payable account)',
  'acc.rec2.ledger': 'Balance of the account in the books',
  'acc.rec2.parties': 'Sum of the balances of the parties',
  'acc.rec2.withoutParty': 'Entries on the account with no party',
  'acc.rec2.outside': 'Entries of parties on other accounts',
  'acc.rec2.count': 'Parties with a balance',
  'acc.rec2.largest': 'Largest balances',
  'acc.rec2.ok': 'The account and the balances of the parties agree.',
  'acc.rec2.why': 'The account is not equal to the parties because some entries on it do not say which customer / supplier they are for. Open the account ledger and set the party on those entries.',
  'acc.rec2.code': 'Code',
};
const ar: Record<string, string> = {
  'acc.rec2.title': 'العملاء والموردون مقابل الدفاتر',
  'acc.rec2.customers': 'العملاء (حساب المدينون)',
  'acc.rec2.suppliers': 'الموردون (حساب الدائنون)',
  'acc.rec2.ledger': 'رصيد الحساب في الدفاتر',
  'acc.rec2.parties': 'مجموع أرصدة الأطراف',
  'acc.rec2.withoutParty': 'قيود على الحساب بدون طرف',
  'acc.rec2.outside': 'قيود الأطراف على حسابات أخرى',
  'acc.rec2.count': 'أطراف لها رصيد',
  'acc.rec2.largest': 'أكبر الأرصدة',
  'acc.rec2.ok': 'الحساب وأرصدة الأطراف متطابقة.',
  'acc.rec2.why': 'الحساب لا يساوي مجموع الأطراف لأن بعض القيود عليه لا تحدد العميل / المورد. افتح دفتر الأستاذ للحساب وحدد الطرف في هذه القيود.',
  'acc.rec2.code': 'الكود',
};
Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);
