import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The texts of the journal reports and the treasury movement report
const en: Record<string, string> = {
  'acc.rep.jdetail': 'Journal entries (detailed)',
  'acc.rep.jsummary': 'Journal entries (summary)',
  'acc.rep.treasury': 'Treasury movement',
  'acc.rep.allSources': 'All entry types',
  'acc.rep.allAccTypes': 'All account types',
  'acc.rep.entryTypeHint': 'Type of entry',
  'acc.rep.touching': 'Touching accounts of type',
  'acc.rep.allCash': 'All cash boxes and banks',
  'acc.rep.entries': 'Entries',
  'acc.rep.bySource': 'Totals by entry type',
  'acc.rep.count': 'Count',
  'acc.rep.reversal': 'reversal',
  'acc.rep.truncated': 'Only the first entries are shown. Narrow the period or the type to see the rest.',
  'acc.rep.noEntries': 'No posted entries match this selection.',
  'acc.rep.cashAccount': 'Cash box / bank',
  'acc.rep.inColumn': 'In',
  'acc.rep.outColumn': 'Out',
  'acc.src.Closing': 'Year closing',
  'acc.src.GatewaySettlement': 'Payment gateway payout',
};

const ar: Record<string, string> = {
  'acc.rep.jdetail': 'القيود اليومية (تفصيلي)',
  'acc.rep.jsummary': 'القيود اليومية (إجمالي)',
  'acc.rep.treasury': 'حركة الخزنة',
  'acc.rep.allSources': 'كل أنواع القيود',
  'acc.rep.allAccTypes': 'كل أنواع الحسابات',
  'acc.rep.entryTypeHint': 'نوع القيد',
  'acc.rep.touching': 'قيود تمس حسابات',
  'acc.rep.allCash': 'كل الخزن والبنوك',
  'acc.rep.entries': 'القيود',
  'acc.rep.bySource': 'الإجمالي حسب نوع القيد',
  'acc.rep.count': 'العدد',
  'acc.rep.reversal': 'عكسي',
  'acc.rep.truncated': 'المعروض أول القيود فقط. ضيّق الفترة أو النوع لرؤية الباقي.',
  'acc.rep.noEntries': 'لا توجد قيود مرحّلة تطابق هذا الاختيار.',
  'acc.rep.cashAccount': 'الخزنة / البنك',
  'acc.rep.inColumn': 'وارد',
  'acc.rep.outColumn': 'منصرف',
  'acc.src.Closing': 'إقفال السنة',
  'acc.src.GatewaySettlement': 'تحويل بوابة الدفع',
};

Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);
