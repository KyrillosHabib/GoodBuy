import './help.i18n';
import { HelpService } from './help.service';
import { Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { ToastService } from '@shared/core/toast.service';
import { AdminApiService } from '@shared/core/admin-api.service';
import { PublicApiService } from '@shared/core/public-api.service';
import { applyTheme } from '@shared/core/theme';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import './inventory-reports/reports.i18n';
import './admin-topbar.i18n';
import './storefront-admin.i18n';
import './order-ops/fulfilment.i18n';
import './order-ops/adjustments.i18n';
import './order-ops/orders.i18n';
import './accounting/einvoices.i18n';
import './accounting/settlements-hub.i18n';

interface TopNote { level: 'bad' | 'warn' | 'info'; text: string; link: string; }
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, IconComponent, ModalComponent],
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly publicApi = inject(PublicApiService);

  // The inventory screens this user can open, in the order the data is entered (the menu numbers them 1, 2, 3 ...)
  readonly inventorySteps = computed(() =>
    [
      { path: '/inventory/warehouses', key: 'inv.nav.warehouses', perms: ['warehouses'] },
      { path: '/inventory/suppliers', key: 'inv.nav.suppliers', perms: ['suppliers'] },
      { path: '/inventory/purchase-orders', key: 'inv.nav.purchaseOrders', perms: ['purchaseOrders', 'purchaseOrders.manage'] },
      { path: '/inventory/stock', key: 'inv.nav.stock', perms: ['inventory'] },
      { path: '/inventory/transfers', key: 'inv.nav.transfers', perms: ['inventory'] },
      { path: '/inventory/returns', key: 'inv.nav.supplierReturns', perms: ['inventory'] },
      { path: '/fulfilment', key: 'ful.title', perms: ['inventory'] },
      { path: '/customer-returns', key: 'cr.title', perms: ['inventory'] },
      { path: '/inventory/adjustments', key: 'adj.title', perms: ['inventory', 'counts'] },
      { path: '/inventory/counts', key: 'inv.nav.counts', perms: ['counts'] },
      { path: '/inventory/history', key: 'inv.nav.history', perms: ['history', 'inventory'] },
      { path: '/inventory/reports', key: 'inv.nav.reports', perms: ['history', 'inventory'] },
    ].filter((st) => this.auth.can(...st.perms)),
  );

  // Accounting, the daily work: what needs a person first, then selling, buying, money, people, clearances, entries and reports
  readonly accountingSteps = computed(() =>
    [
      { path: '/accounting/inbox', key: 'acc.nav.inbox', perms: ['accounting', 'accounting.documents', 'accounting.approve', 'accounting.treasury'] },
      { path: '/accounting/sales', key: 'acc.nav.sales', perms: ['accounting', 'accounting.documents', 'accounting.approve'] },
      { path: '/accounting/purchases', key: 'acc.nav.purchases', perms: ['accounting', 'accounting.documents', 'accounting.approve'] },
      { path: '/accounting/treasury', key: 'acc.nav.treasury', perms: ['accounting', 'accounting.treasury', 'accounting.approve'] },
      { path: '/accounting/parties', key: 'acc.nav.parties', perms: ['accounting', 'accounting.parties'] },
      { path: '/accounting/settlements-hub', key: 'acc.nav.settlementsHub', perms: ['accounting', 'accounting.settlements', 'accounting.settlements.approve', 'accounting.treasury', 'accounting.approve'] },
      { path: '/accounting/journal', key: 'acc.nav.journal', perms: ['accounting', 'accounting.journal', 'accounting.approve'] },
      { path: '/accounting/reports', key: 'acc.nav.reports', perms: ['accounting.reports'] },
      { path: '/accounting/einvoices', key: 'acc.nav.einvoices', perms: ['accounting.documents', 'accounting.reports', 'accounting.settings'] },
    ].filter((st) => this.auth.can(...st.perms)),
  );

  // Accounting settings: set once, change rarely
  readonly accountingSetupSteps = computed(() =>
    [
      { path: '/accounting/chart', key: 'acc.nav.chart', perms: ['accounting.chart'] },
      { path: '/accounting/basic-accounts', key: 'acc.nav.basic', perms: ['accounting.settings', 'accounting.chart'] },
      { path: '/accounting/auto-entries', key: 'acc.nav.autoEntries', perms: ['accounting.settings', 'accounting.chart'] },
      { path: '/accounting/automation', key: 'acc.nav.automation', perms: ['accounting.settings'] },
      { path: '/accounting/cash-setup', key: 'acc.nav.cashSetup', perms: ['accounting.treasury', 'accounting.settings'] },
      { path: '/accounting/banks', key: 'acc.nav.banks', perms: ['accounting.treasury', 'accounting.settings'] },
      { path: '/accounting/currencies', key: 'acc.nav.currencies', perms: ['settings', 'accounting.settings'] },
      { path: '/accounting/carriers', key: 'acc.nav.carriers', perms: ['accounting.settings', 'accounting.treasury'] },
      { path: '/accounting/periods', key: 'acc.nav.periods', perms: ['accounting.settings'] },
      { path: '/accounting/opening', key: 'acc.nav.opening', perms: ['accounting.settings', 'accounting.approve'] },
      { path: '/accounting/settings', key: 'acc.nav.settings', perms: ['accounting.settings'] },
      { path: '/accounting/audit', key: 'acc.nav.audit', perms: ['accounting', 'accounting.chart', 'accounting.approve', 'accounting.settings'] },
    ].filter((st) => this.auth.can(...st.perms)),
  );

  // ---- the menu: every group opens and closes like a drop-down; the group of the open screen opens by itself
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly openGroups = signal<Set<string>>(new Set());
  private readonly url = signal(this.router.url);
  // The group of the screen that is open: it stays marked even when the group is folded
  readonly currentGroup = computed(() => this.groupOf(this.url()));

  isOpen(id: string): boolean {
    return this.openGroups().has(id);
  }

  toggleGroup(id: string): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  private groupOf(url: string): string | null {
    const path = url.split('?')[0].split('#')[0];
    const starts = (...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + '/'));

    if (starts('/accounting/chart', '/accounting/basic-accounts', '/accounting/auto-entries', '/accounting/automation', '/accounting/cash-setup', '/accounting/banks', '/accounting/carriers', '/accounting/currencies', '/accounting/periods', '/accounting/opening', '/accounting/settings', '/accounting/audit')) return 'accountingSetup';
    if (starts('/accounting')) return 'accounting';
    if (starts('/products', '/packages', '/categories', '/brands')) return 'catalog';
    if (starts('/content', '/company', '/settings', '/storefront')) return 'website';
    if (starts('/orders', '/discounts', '/promotions', '/auctions', '/coupons', '/order-emails', '/return-policy', '/inquiries')) return 'sales';
    if (starts('/users')) return 'people';
    if (starts('/inventory') || this.inventorySteps().some((st) => starts(st.path))) return 'inventory';
    if (starts('/fulfilment', '/customer-returns')) return 'sales';
    return null;
  }

  private openGroupOf(url: string): void {
    const id = this.groupOf(url);
    if (id) this.openGroups.update((set) => new Set(set).add(id));
  }

  constructor() {
    this.openGroupOf(this.router.url);

    // Dark mode: one attribute on <html>; the colors change through the css variables
    effect(() => {
      document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
      localStorage.setItem('voltara.admin.theme', this.dark() ? 'dark' : 'light');
    });

    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url.set(e.urlAfterRedirects);
        this.openGroupOf(e.urlAfterRedirects);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  readonly auth = inject(AuthService);
  readonly help = inject(HelpService);
  readonly i18n = inject(I18nService);
  readonly collapsed = signal(localStorage.getItem('voltara.admin.side') === '1');
  readonly mobileOpen = signal(false);

  // One button for every screen size: on a phone it slides the menu over the page, on a computer it hides / shows it
  // Is the menu on the screen right now? (the button draws itself accordingly)
  sideShown(): boolean {
    return window.innerWidth <= 960 ? this.mobileOpen() : !this.collapsed();
  }

  onMenu(): void {
    if (window.innerWidth <= 960) this.mobileOpen.update((v) => !v);
    else this.toggle();
  }

  // ---------- the top bar
  private readonly accountingApi = inject(AccountingApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly toast = inject(ToastService);

  // Which small window is open: the search results, the language, the notifications or the account menu
  readonly menu = signal<'search' | 'bell' | 'account' | null>(null);
  readonly term = signal('');
  readonly results = signal<{ label: string; href: string }[]>([]);
  readonly dark = signal(localStorage.getItem('voltara.admin.theme') === 'dark');

  private readonly accPending = signal<{ documents: number; vouchers: number; journal: number; transfers: number; settlements: number; carrierSettlements: number; issues: number } | null>(null);
  private readonly invSummary = signal<{ lowStockItems: number; expiredBatches: number; expiringSoonBatches: number } | null>(null);

  // What needs this person, built from the numbers the server already has (only what his permissions allow him to see)
  readonly notes = computed<TopNote[]>(() => {
    const t = (key: string, n: number): string => this.i18n.t(key, { n });
    const list: TopNote[] = [];
    const a = this.accPending();
    const i = this.invSummary();

    if (a) {
      if (a.documents > 0) list.push({ level: 'warn', text: t('a.top.n.docs', a.documents), link: '/accounting/sales' });
      if (a.vouchers + a.transfers + a.carrierSettlements > 0) list.push({ level: 'warn', text: t('a.top.n.treasury', a.vouchers + a.transfers + a.carrierSettlements), link: '/accounting/treasury' });
      if (a.journal > 0) list.push({ level: 'warn', text: t('a.top.n.journal', a.journal), link: '/accounting/journal' });
      if (a.settlements > 0) list.push({ level: 'warn', text: t('a.top.n.settlements', a.settlements), link: '/accounting/settlements' });
      if (a.issues > 0) list.push({ level: 'bad', text: t('a.top.n.issues', a.issues), link: '/accounting/inbox' });
    }

    if (i) {
      if (i.expiredBatches > 0) list.push({ level: 'bad', text: t('a.top.n.expired', i.expiredBatches), link: '/inventory/history' });
      if (i.lowStockItems > 0) list.push({ level: 'warn', text: t('a.top.n.low', i.lowStockItems), link: '/inventory/stock' });
      if (i.expiringSoonBatches > 0) list.push({ level: 'info', text: t('a.top.n.expiring', i.expiringSoonBatches), link: '/inventory/history' });
    }

    return list;
  });

  // The name shown for the signed-in person: the user name of an employee (the placeholder e-mail is not shown) or the e-mail
  readonly userName = computed(() => {
    const email = this.auth.email();

    return email.endsWith('@staff.voltara.local') ? email.split('@')[0] : email;
  });

  readonly initials = computed(() => (this.userName().trim().charAt(0) || '?').toUpperCase());

  readonly roleName = computed(() => {
    const role = this.auth.isAdmin() ? 'Admin' : this.auth.roles().find((r) => r !== 'Customer') ?? '';

    return role ? this.i18n.t('role.' + role) : '';
  });

  // The change-password window
  readonly pwOpen = signal(false);
  readonly pwBusy = signal(false);
  readonly pwCurrent = signal('');
  readonly pwNext = signal('');
  readonly pwConfirm = signal('');

  ngOnInit(): void {
    // The roles may have been changed since this user signed in: the menu follows what the server says now
    this.auth.refreshAccess().subscribe({ error: () => undefined });

    // The notifications bell
    if (this.auth.can('accounting', 'accounting.documents', 'accounting.approve', 'accounting.treasury')) {
      this.accountingApi.getPending().subscribe({ next: (p) => this.accPending.set(p), error: () => undefined });
    }

    if (this.auth.can('inventory')) {
      this.inventoryApi.getSummary().subscribe({ next: (x) => this.invSummary.set(x), error: () => undefined });
    }

    // The dashboard wears the same colors, fonts and icon as the website
    // The settings endpoint is for administrators only: a warehouse employee takes the same colors from the public one
    // (calling the admin endpoint as an employee returned 403 on every page, which showed a "no permission" message)
    if (this.auth.can('settings')) {
      this.api.getSettings().subscribe((s) => applyTheme(s));
    } else {
      this.publicApi.getHome().subscribe({ next: (h) => applyTheme(h.settings), error: () => undefined });
    }
  }

  // A click outside the small windows closes them
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!(event.target as HTMLElement).closest('.topbar-item')) this.menu.set(null);
  }

  toggleMenu(name: 'bell' | 'account'): void {
    this.menu.update((current) => (current === name ? null : name));
  }

  // Search the menu: the screens this person can open (read from the menu itself, so it always matches what he sees)
  onSearch(value: string): void {
    this.term.set(value);

    const q = value.trim().toLowerCase();

    if (!q) {
      this.results.set([]);
      this.menu.set(null);

      return;
    }

    const seen = new Set<string>();
    const found: { label: string; href: string }[] = [];

    document.querySelectorAll<HTMLAnchorElement>('.admin-side nav a[href]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/^\d+\s*/, '');

      if (href && !seen.has(href) && label.toLowerCase().includes(q)) {
        seen.add(href);
        found.push({ label, href });
      }
    });

    this.results.set(found.slice(0, 8));
    this.menu.set('search');
  }

  go(href: string): void {
    this.term.set('');
    this.results.set([]);
    this.menu.set(null);
    void this.router.navigateByUrl(href);
  }

  // One click to the other language. The screens reload so the names that come from the server (products, warehouses) follow the language too
  switchLang(): void {
    this.i18n.set(this.i18n.isRtl() ? 'en' : 'ar');
    this.menu.set(null);
    setTimeout(() => window.location.reload(), 50);
  }

  toggleTheme(): void {
    this.dark.update((v) => !v);
  }

  openPassword(): void {
    this.pwCurrent.set('');
    this.pwNext.set('');
    this.pwConfirm.set('');
    this.pwOpen.set(true);
    this.menu.set(null);
  }

  savePassword(): void {
    if (this.pwNext().length < 6) return void this.toast.error(this.i18n.t('a.top.pwShort'));
    if (this.pwNext() !== this.pwConfirm()) return void this.toast.error(this.i18n.t('a.top.pwMismatch'));

    this.pwBusy.set(true);

    // The server closes the session after the change: the person signs in again with the new password
    this.auth.changeOwnPassword(this.pwCurrent(), this.pwNext()).subscribe({
      next: () => {
        this.pwBusy.set(false);
        this.pwOpen.set(false);
        this.toast.success(this.i18n.t('a.top.pwDone'));
        this.auth.logout();
      },
      error: () => {
        this.pwBusy.set(false);
        this.toast.error(this.i18n.t('a.top.pwFail'));
      },
    });
  }

  toggle(): void {
    this.collapsed.update((v) => !v);
    localStorage.setItem('voltara.admin.side', this.collapsed() ? '1' : '0');
  }
}
