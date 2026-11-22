import { DICTIONARY } from '@shared/core/i18n.dictionary';

// The texts of the top bar (search, language, theme, notifications, account)

const en: Record<string, string> = {
  'a.top.search': 'Search the menu...',
  'a.top.noResults': 'Nothing found',
  'a.top.language': 'Language',
  'a.top.darkMode': 'Dark mode',
  'a.top.lightMode': 'Light mode',
  'a.top.notifications': 'Notifications',
  'a.top.noNotifications': 'No notifications. Everything is fine.',
  'a.top.account': 'My account',
  'a.top.changePassword': 'Change password',
  'a.top.currentPassword': 'Current password',
  'a.top.newPassword': 'New password',
  'a.top.confirmPassword': 'Repeat the new password',
  'a.top.pwHint': 'After the change you sign in again with the new password.',
  'a.top.pwMismatch': 'The two passwords are not the same.',
  'a.top.pwShort': 'The new password must be 6 characters or more.',
  'a.top.pwDone': 'Password changed. Sign in with the new one.',
  'a.top.pwFail': 'The password was not changed. Check the current password.',
  'a.top.save': 'Save',
  'a.top.n.docs': '{n} documents wait for approval',
  'a.top.n.treasury': '{n} vouchers / transfers wait for approval',
  'a.top.n.journal': '{n} journal entries wait for approval',
  'a.top.n.settlements': '{n} clearances wait for approval',
  'a.top.n.issues': '{n} posting issues need a look',
  'a.top.n.low': '{n} items are low in stock',
  'a.top.n.expired': '{n} batches have expired',
  'a.top.n.expiring': '{n} batches expire in 30 days',
};

const ar: Record<string, string> = {
  'a.top.search': 'ابحث في القائمة...',
  'a.top.noResults': 'مفيش نتائج',
  'a.top.language': 'اللغة',
  'a.top.darkMode': 'الوضع الداكن',
  'a.top.lightMode': 'الوضع الفاتح',
  'a.top.notifications': 'الإشعارات',
  'a.top.noNotifications': 'مفيش إشعارات. كل حاجة تمام.',
  'a.top.account': 'حسابي',
  'a.top.changePassword': 'تغيير كلمة المرور',
  'a.top.currentPassword': 'كلمة المرور الحالية',
  'a.top.newPassword': 'كلمة المرور الجديدة',
  'a.top.confirmPassword': 'أعد كتابة كلمة المرور الجديدة',
  'a.top.pwHint': 'بعد التغيير هتدخل من جديد بكلمة المرور الجديدة.',
  'a.top.pwMismatch': 'كلمتا المرور مش متطابقتين.',
  'a.top.pwShort': 'كلمة المرور الجديدة لازم تكون 6 أحرف أو أكتر.',
  'a.top.pwDone': 'تم تغيير كلمة المرور. ادخل بالجديدة.',
  'a.top.pwFail': 'كلمة المرور ما اتغيرتش. اتأكد من كلمة المرور الحالية.',
  'a.top.save': 'حفظ',
  'a.top.n.docs': '{n} مستند منتظر الاعتماد',
  'a.top.n.treasury': '{n} سند / تحويل منتظر الاعتماد',
  'a.top.n.journal': '{n} قيد منتظر الاعتماد',
  'a.top.n.settlements': '{n} تسوية منتظرة الاعتماد',
  'a.top.n.issues': '{n} مشكلة ترحيل محتاجة مراجعة',
  'a.top.n.low': '{n} صنف مخزونه منخفض',
  'a.top.n.expired': '{n} دفعة انتهت صلاحيتها',
  'a.top.n.expiring': '{n} دفعة هتنتهي خلال 30 يوم',
};

Object.assign(DICTIONARY.en, en);
Object.assign(DICTIONARY.ar, ar);
