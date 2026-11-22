import { Routes } from '@angular/router';
import { customerGuard, guestGuard } from '@shared/core/auth.guard';

// The public website only. The dashboard is a separate application (projects/admin).
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./home.component').then((m) => m.HomeComponent) },
      { path: 'about', loadComponent: () => import('./about.component').then((m) => m.AboutComponent) },
      { path: 'products', loadComponent: () => import('./products.component').then((m) => m.ProductsComponent) },
      { path: 'products/:slug', loadComponent: () => import('./product-details.component').then((m) => m.ProductDetailsComponent) },
      { path: 'auctions', loadComponent: () => import('./auctions.component').then((m) => m.AuctionsComponent) },
      { path: 'auctions/:id', loadComponent: () => import('./auction-details.component').then((m) => m.AuctionDetailsComponent) },
      { path: 'checkout', loadComponent: () => import('./checkout.component').then((m) => m.CheckoutComponent) },
      { path: 'order/:number', loadComponent: () => import('./order-confirmation.component').then((m) => m.OrderConfirmationComponent) },
      { path: 'cart', loadComponent: () => import('./cart.component').then((m) => m.CartComponent) },
      { path: 'login', canActivate: [guestGuard], data: { tab: 'login' }, loadComponent: () => import('./auth-redirect.component').then((m) => m.AuthRedirectComponent) },
      { path: 'register', canActivate: [guestGuard], data: { tab: 'register' }, loadComponent: () => import('./auth-redirect.component').then((m) => m.AuthRedirectComponent) },
      { path: 'verify-email', loadComponent: () => import('./verify-email.component').then((m) => m.VerifyEmailComponent) },
      { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./forgot-password.component').then((m) => m.ForgotPasswordComponent) },
      { path: 'account', canActivate: [customerGuard], loadComponent: () => import('./account.component').then((m) => m.AccountComponent) },
      { path: 'returns', loadComponent: () => import('./returns.component').then((m) => m.ReturnsComponent) },
      { path: 'contact', loadComponent: () => import('./contact.component').then((m) => m.ContactComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
