import { Routes } from '@angular/router';
import { dashboardGuard, homeGuard, loginGuard, permissionGuard } from '@shared/core/auth.guard';

// The dashboard is its own application: it has no link to / from the public website.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./admin-login.component').then((m) => m.AdminLoginComponent),
  },
  // The invoice opens outside the dashboard frame, so only the invoice is printed
  { path: 'orders/:id/invoice', canActivate: [dashboardGuard, permissionGuard('orders')], loadComponent: () => import('./order-ops/order-invoice.component').then((m) => m.OrderInvoiceComponent) },
  {
    path: '',
    canActivate: [dashboardGuard],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeGuard], loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'products', canActivate: [permissionGuard('products')], loadComponent: () => import('./products-admin.component').then((m) => m.ProductsAdminComponent) },
      { path: 'packages', canActivate: [permissionGuard('products')], loadComponent: () => import('./packages-admin.component').then((m) => m.PackagesAdminComponent) },
      { path: 'categories', canActivate: [permissionGuard('categories')], loadComponent: () => import('./categories-admin.component').then((m) => m.CategoriesAdminComponent) },
      { path: 'brands', canActivate: [permissionGuard('brands')], loadComponent: () => import('./brands-admin.component').then((m) => m.BrandsAdminComponent) },
      { path: 'content', canActivate: [permissionGuard('content')], loadComponent: () => import('./content-admin.component').then((m) => m.ContentAdminComponent) },
      { path: 'company', canActivate: [permissionGuard('company')], loadComponent: () => import('./company-admin.component').then((m) => m.CompanyAdminComponent) },
      { path: 'storefront', canActivate: [permissionGuard('settings')], loadComponent: () => import('./storefront-admin.component').then((m) => m.StorefrontAdminComponent) },
      { path: 'settings', canActivate: [permissionGuard('settings')], loadComponent: () => import('./settings-admin.component').then((m) => m.SettingsAdminComponent) },

      // Inventory
      { path: 'inventory', canActivate: [permissionGuard('inventory.dashboard', 'inventory')], loadComponent: () => import('./inventory-home.component').then((m) => m.InventoryHomeComponent) },
      { path: 'inventory/stock', canActivate: [permissionGuard('inventory')], loadComponent: () => import('./inventory-stock.component').then((m) => m.InventoryStockComponent) },
      { path: 'inventory/history', canActivate: [permissionGuard('history', 'inventory')], loadComponent: () => import('./inventory-history.component').then((m) => m.InventoryHistoryComponent) },
      { path: 'inventory/counts', canActivate: [permissionGuard('counts')], loadComponent: () => import('./inventory-counts.component').then((m) => m.InventoryCountsComponent) },
      { path: 'inventory/purchase-orders', canActivate: [permissionGuard('purchaseOrders', 'purchaseOrders.manage')], loadComponent: () => import('./purchase-orders-admin.component').then((m) => m.PurchaseOrdersAdminComponent) },
      { path: 'inventory/transfers', canActivate: [permissionGuard('inventory')], loadComponent: () => import('./inventory-ops/transfers-list.component').then((m) => m.TransfersListComponent) },
      { path: 'inventory/transfers/:id', canActivate: [permissionGuard('inventory')], loadComponent: () => import('./inventory-ops/transfer-detail.component').then((m) => m.TransferDetailComponent) },
      { path: 'inventory/returns', canActivate: [permissionGuard('inventory')], loadComponent: () => import('./inventory-ops/supplier-returns-list.component').then((m) => m.SupplierReturnsListComponent) },
      { path: 'inventory/returns/:id', canActivate: [permissionGuard('inventory')], loadComponent: () => import('./inventory-ops/supplier-return-detail.component').then((m) => m.SupplierReturnDetailComponent) },
      { path: 'inventory/adjustments', canActivate: [permissionGuard('inventory', 'counts', 'history')], loadComponent: () => import('./order-ops/stock-adjustments-list.component').then((m) => m.StockAdjustmentsListComponent) },
      { path: 'inventory/adjustments/:id', canActivate: [permissionGuard('inventory', 'counts', 'history')], loadComponent: () => import('./order-ops/stock-adjustment-detail.component').then((m) => m.StockAdjustmentDetailComponent) },
      { path: 'fulfilment', canActivate: [permissionGuard('inventory', 'orders')], loadComponent: () => import('./order-ops/fulfilment-board.component').then((m) => m.FulfilmentBoardComponent) },
      { path: 'customer-returns', canActivate: [permissionGuard('inventory', 'orders', 'history')], loadComponent: () => import('./order-ops/customer-returns-list.component').then((m) => m.CustomerReturnsListComponent) },
      { path: 'customer-returns/:id', canActivate: [permissionGuard('inventory', 'orders', 'history')], loadComponent: () => import('./order-ops/customer-return-detail.component').then((m) => m.CustomerReturnDetailComponent) },
      { path: 'inventory/warehouses', canActivate: [permissionGuard('warehouses')], loadComponent: () => import('./warehouses-admin.component').then((m) => m.WarehousesAdminComponent) },
      { path: 'inventory/suppliers', canActivate: [permissionGuard('suppliers', 'purchaseOrders.manage')], loadComponent: () => import('./suppliers-admin.component').then((m) => m.SuppliersAdminComponent) },

      // Orders and sales
      { path: 'orders', canActivate: [permissionGuard('orders')], loadComponent: () => import('./orders-admin.component').then((m) => m.OrdersAdminComponent) },
      { path: 'orders/:id', canActivate: [permissionGuard('orders')], loadComponent: () => import('./order-ops/order-detail.component').then((m) => m.OrderDetailComponent) },
      { path: 'order-emails', canActivate: [permissionGuard('orderEmails')], loadComponent: () => import('./order-emails-admin.component').then((m) => m.OrderEmailsAdminComponent) },
      { path: 'return-policy', canActivate: [permissionGuard('returnPolicy')], loadComponent: () => import('./return-policy-admin.component').then((m) => m.ReturnPolicyAdminComponent) },
      { path: 'discounts', canActivate: [permissionGuard('discounts')], loadComponent: () => import('./discounts-admin.component').then((m) => m.DiscountsAdminComponent) },
      { path: 'promotions', canActivate: [permissionGuard('promotions')], loadComponent: () => import('./promotions-admin.component').then((m) => m.PromotionsAdminComponent) },
      { path: 'auctions', canActivate: [permissionGuard('auctions')], loadComponent: () => import('./auctions-admin.component').then((m) => m.AuctionsAdminComponent) },
      { path: 'wheel', canActivate: [permissionGuard('wheel')], loadComponent: () => import('./wheel-admin.component').then((m) => m.WheelAdminComponent) },
      { path: 'reviews', canActivate: [permissionGuard('reviews')], loadComponent: () => import('./reviews-admin.component').then((m) => m.ReviewsAdminComponent) },
      { path: 'coupons', canActivate: [permissionGuard('coupons')], loadComponent: () => import('./coupons-admin.component').then((m) => m.CouponsAdminComponent) },

      // Accounting
      { path: 'accounting', canActivate: [permissionGuard('accounting.dashboard')], loadComponent: () => import('./accounting/accounting-home.component').then((m) => m.AccountingHomeComponent) },
      { path: 'accounting/inbox', canActivate: [permissionGuard('accounting', 'accounting.documents', 'accounting.approve', 'accounting.treasury')], loadComponent: () => import('./accounting/inbox-admin.component').then((m) => m.InboxAdminComponent) },
      { path: 'accounting/sales', canActivate: [permissionGuard('accounting', 'accounting.documents', 'accounting.approve')], data: { scope: 'sales' }, loadComponent: () => import('./accounting/documents-admin.component').then((m) => m.DocumentsAdminComponent) },
      { path: 'accounting/purchases', canActivate: [permissionGuard('accounting', 'accounting.documents', 'accounting.approve')], data: { scope: 'purchases' }, loadComponent: () => import('./accounting/documents-admin.component').then((m) => m.DocumentsAdminComponent) },
      { path: 'accounting/treasury', canActivate: [permissionGuard('accounting', 'accounting.treasury', 'accounting.approve')], loadComponent: () => import('./accounting/treasury-admin.component').then((m) => m.TreasuryAdminComponent) },
      { path: 'accounting/parties', canActivate: [permissionGuard('accounting', 'accounting.parties')], loadComponent: () => import('./accounting/parties-admin.component').then((m) => m.PartiesAdminComponent) },
      { path: 'accounting/settlements-hub', canActivate: [permissionGuard('accounting', 'accounting.settlements', 'accounting.settlements.approve', 'accounting.treasury', 'accounting.approve')], loadComponent: () => import('./accounting/settlements-hub.component').then((m) => m.SettlementsHubComponent) },
      { path: 'accounting/settlements', canActivate: [permissionGuard('accounting', 'accounting.settlements', 'accounting.settlements.approve')], loadComponent: () => import('./accounting/settlements-admin.component').then((m) => m.SettlementsAdminComponent) },
      { path: 'accounting/journal', canActivate: [permissionGuard('accounting', 'accounting.journal', 'accounting.approve')], loadComponent: () => import('./accounting/journal-admin.component').then((m) => m.JournalAdminComponent) },
      { path: 'accounting/einvoices', canActivate: [permissionGuard('accounting.documents', 'accounting.reports', 'accounting.settings')], loadComponent: () => import('./accounting/einvoices-admin.component').then((m) => m.EInvoicesAdminComponent) },
      { path: 'accounting/reports', canActivate: [permissionGuard('accounting.reports')], loadComponent: () => import('./accounting/reports-admin.component').then((m) => m.ReportsAdminComponent) },
      { path: 'accounting/chart', canActivate: [permissionGuard('accounting.chart')], loadComponent: () => import('./accounting/chart-admin.component').then((m) => m.ChartAdminComponent) },
      { path: 'accounting/basic-accounts', canActivate: [permissionGuard('accounting.settings', 'accounting.chart')], loadComponent: () => import('./accounting/basic-accounts-admin.component').then((m) => m.BasicAccountsAdminComponent) },
      { path: 'accounting/auto-entries', canActivate: [permissionGuard('accounting.settings', 'accounting.chart')], loadComponent: () => import('./accounting/posting-templates-admin.component').then((m) => m.PostingTemplatesAdminComponent) },
      { path: 'accounting/banks', canActivate: [permissionGuard('accounting.treasury', 'accounting.settings')], loadComponent: () => import('./accounting/banks-admin.component').then((m) => m.BanksAdminComponent) },
      { path: 'accounting/periods', canActivate: [permissionGuard('accounting.settings')], loadComponent: () => import('./accounting/periods-admin.component').then((m) => m.PeriodsAdminComponent) },
      { path: 'accounting/opening', canActivate: [permissionGuard('accounting.settings', 'accounting.approve')], loadComponent: () => import('./accounting/opening-admin.component').then((m) => m.OpeningAdminComponent) },
      { path: 'accounting/automation', canActivate: [permissionGuard('accounting.settings')], loadComponent: () => import('./accounting/automation-admin.component').then((m) => m.AutomationAdminComponent) },
      { path: 'accounting/cash-setup', canActivate: [permissionGuard('accounting.treasury', 'accounting.settings')], data: { only: true }, loadComponent: () => import('./accounting/treasury-admin.component').then((m) => m.TreasuryAdminComponent) },
      { path: 'accounting/currencies', canActivate: [permissionGuard('settings', 'accounting.settings')], loadComponent: () => import('./accounting/currencies-admin.component').then((m) => m.CurrenciesAdminComponent) },
      { path: 'accounting/carriers', canActivate: [permissionGuard('accounting.settings', 'accounting.treasury')], loadComponent: () => import('./accounting/carriers-admin.component').then((m) => m.CarriersAdminComponent) },
      { path: 'accounting/settings', canActivate: [permissionGuard('accounting.settings')], loadComponent: () => import('./accounting/accounting-settings.component').then((m) => m.AccountingSettingsComponent) },
      { path: 'accounting/audit', canActivate: [permissionGuard('accounting', 'accounting.chart', 'accounting.parties', 'accounting.documents', 'accounting.journal', 'accounting.treasury', 'accounting.settlements', 'accounting.approve', 'accounting.settlements.approve', 'accounting.reports', 'accounting.settings')], loadComponent: () => import('./accounting/audit-admin.component').then((m) => m.AuditAdminComponent) },

      // Users and inquiries
      { path: 'users', canActivate: [permissionGuard('users')], loadComponent: () => import('./users-admin.component').then((m) => m.UsersAdminComponent) },
      { path: 'inquiries', canActivate: [permissionGuard('inquiries')], loadComponent: () => import('./inquiries-admin.component').then((m) => m.InquiriesAdminComponent) },

      { path: 'inventory/reports', canActivate: [permissionGuard('history', 'inventory')], loadComponent: () => import('./inventory-reports/reports-hub.component').then((m) => m.ReportsHubComponent) },
      { path: 'inventory/reports/:code', canActivate: [permissionGuard('history', 'inventory')], loadComponent: () => import('./inventory-reports/report-view.component').then((m) => m.ReportViewComponent) },
      { path: 'products/:id/stock', canActivate: [permissionGuard('history', 'inventory')], loadComponent: () => import('./inventory-ops/product-stock.component').then((m) => m.ProductStockComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];