import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The texts of the unified settlements screen (customers and suppliers, shipping companies, payment gateways) and of the reconciliations report.
// Added to the main dictionary when this file is loaded.

const en: Record<string, string> = {
  'acc.nav.settlementsHub': 'Settlements',
  'acc.nav.settlementsHub.hint': 'Clearances of customers and suppliers, shipping companies and payment gateways in one place.',
  'acc.hub.intro': 'Every settlement of the money or of an account in one place: choose what you are settling.',
  'acc.hub.parties': 'Customers and suppliers',
  'acc.hub.carriers': 'Shipping companies',
  'acc.hub.gateways': 'Payment gateways',
  'acc.hub.waitingSettle': 'Waiting to be settled',
  'acc.hub.waitingApproval': 'Waiting for approval',
  'acc.hub.items': 'items',
  'acc.hub.noTabs': 'You do not have permission for any kind of settlement.',

  // reconciliations report (the old "stock vs books" tab)
  'acc.rep.inventory': 'Reconciliations',
  'acc.rec.inventory': 'Inventory',
  'acc.rec.customers': 'Customers',
  'acc.rec.suppliers': 'Suppliers',
  'acc.rec.ledger': 'Balance in the books',
  'acc.rec.sub': 'Sum of the balances of the parties',
  'acc.rec.diff': 'Difference',
  'acc.rec.ok': 'The books and the details agree.',
  'acc.rec.diffParties': 'Parties whose balance differs',
  'acc.rec.party': 'Party',
  'acc.rec.byLedger': 'In the books',
  'acc.rec.byDocs': 'By documents',
  'acc.rec.diffHint': 'A difference usually means an entry made by hand on the control account, a receipt not matched to its invoice, or an entry still waiting for approval.',
  'acc.rec.controlAccount': 'Control account',
};

const ar: Record<string, string> = {
  'acc.nav.settlementsHub': 'التسويات',
  'acc.nav.settlementsHub.hint': 'مخالصات العملاء والموردين وشركات الشحن وبوابات الدفع في مكان واحد.',
  'acc.hub.intro': 'كل أنواع التسويات في مكان واحد.\n1) اختر ما تريد تسويته.\n2) تابع الخطوات في الشاشة التي تفتح.',
  'acc.hub.parties': 'العملاء والموردون',
  'acc.hub.carriers': 'شركات الشحن',
  'acc.hub.gateways': 'بوابات الدفع',
  'acc.hub.waitingSettle': 'بانتظار التسوية',
  'acc.hub.waitingApproval': 'بانتظار الاعتماد',
  'acc.hub.items': 'بنود',
  'acc.hub.noTabs': 'ليست لديك صلاحية على أي نوع من التسويات.',

  'acc.rep.inventory': 'المطابقات',
  'acc.rec.inventory': 'المخزون',
  'acc.rec.customers': 'العملاء',
  'acc.rec.suppliers': 'الموردون',
  'acc.rec.ledger': 'الرصيد في الدفاتر',
  'acc.rec.sub': 'مجموع أرصدة الأطراف',
  'acc.rec.diff': 'الفرق',
  'acc.rec.ok': 'الدفاتر والتفاصيل متطابقة.',
  'acc.rec.diffParties': 'الأطراف التي يختلف رصيدها',
  'acc.rec.party': 'الطرف',
  'acc.rec.byLedger': 'في الدفاتر',
  'acc.rec.byDocs': 'حسب المستندات',
  'acc.rec.diffHint': 'الفرق غالباً من قيد يدوي على الحساب الرئيسي، أو سند قبض غير مربوط بفاتورته، أو قيد ينتظر الاعتماد.',
  'acc.rec.controlAccount': 'الحساب الرئيسي',
};

Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);
