import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/login']);
};

// A dashboard screen: open to the Admin role and to the roles that were given (any of) these permissions
export const permissionGuard = (...anyOf: string[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.can(...anyOf)) return true;

  return router.createUrlTree([firstAllowedPage(auth)]);
};

// Where a user lands when the page they asked for (or the dashboard home) is not for them
const START_PAGES: [string[], string][] = [
  [['inventory.dashboard'], '/inventory'],
  [['inventory'], '/inventory/stock'],
  [['counts'], '/inventory/counts'],
  [['purchaseOrders', 'purchaseOrders.manage'], '/inventory/purchase-orders'],
  [['history'], '/inventory/history'],
  // The accounting dashboard is for the head of the department; an employee starts in the inbox (what waits for him), or in his own screen
  [['accounting.dashboard'], '/accounting'],
  [['accounting', 'accounting.documents', 'accounting.approve', 'accounting.treasury'], '/accounting/inbox'],
  [['accounting.parties'], '/accounting/parties'],
  [['accounting.journal'], '/accounting/journal'],
  [['accounting.settlements', 'accounting.settlements.approve'], '/accounting/settlements'],
  [['accounting.reports'], '/accounting/reports'],
  [['accounting.chart'], '/accounting/chart'],
  [['accounting.settings'], '/accounting/settings'],
  [['orders'], '/orders'],
  [['products'], '/products'],
  [['categories'], '/categories'],
  [['inquiries'], '/inquiries'],
  [['users'], '/users'],
];

export function firstAllowedPage(auth: AuthService): string {
  if (auth.isAdmin()) return '/';

  return START_PAGES.find(([permissions]) => auth.can(...permissions))?.[1] ?? '/login';
}

// The dashboard shell: administrators and warehouse employees
export const dashboardGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.canUseDashboard()) return router.createUrlTree(['/login']);

  // The password was given by the administrator: nothing else opens before it is replaced
  return auth.mustChangePassword() ? router.createUrlTree(['/login']) : true;
};

// The dashboard home: a warehouse employee starts in the inventory instead
export const homeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  const target = firstAllowedPage(auth);

  // A role with no screen at all: back to the login page (and not to this guard again)
  return target === '/login' ? router.createUrlTree(['/login']) : router.createUrlTree([target]);
};

// The login page redirects to the panel when already signed in
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canUseDashboard() && !auth.mustChangePassword() ? inject(Router).createUrlTree(['/']) : true;
};

// Shop pages that need a signed-in customer: sends guests to the login page and brings them back after
export const customerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isCustomer() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// Login / register pages: a signed-in customer has nothing to do there
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isCustomer() ? inject(Router).createUrlTree(['/account']) : true;
};