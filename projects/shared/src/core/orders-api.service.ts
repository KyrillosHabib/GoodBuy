import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { AuctionOrderForm, CheckoutForm, Order, OrderEmailTemplates, OrderUpdate, PlacedOrder } from './models';

// Orders: the checkout (guest or customer), the customer's own orders and the dashboard side
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/orders`;
  private readonly admin = `${environment.apiUrl}/api/admin/orders`;

  // `cartToken`: the guest's X-Cart-Token (a signed-in customer's cart follows the account)
  place(form: CheckoutForm, cartToken: string | null): Observable<PlacedOrder> {
    return this.http.post<PlacedOrder>(this.url, form, { headers: cartToken ? { 'X-Cart-Token': cartToken } : {} });
  }

  get(number: string, token: string | null): Observable<Order> {
    let params = new HttpParams();
    if (token) params = params.set('token', token);
    return this.http.get<Order>(`${this.url}/${encodeURIComponent(number)}`, { params });
  }

  // The winner of an auction finishes his ready order (a signed-in winner needs no token)
  completeAuction(number: string, token: string | null, form: AuctionOrderForm): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(number)}/auction`, { token, ...form });
  }

  mine(): Observable<Order[]> {
    return this.http.get<Order[]>(this.url);
  }

  // ---------- dashboard (administrator)
  getAll(): Observable<Order[]> { return this.http.get<Order[]>(this.admin); }
  getOne(id: number): Observable<Order> { return this.http.get<Order>(`${this.admin}/${id}`); }
  addNote(id: number, text: string): Observable<void> { return this.http.post<void>(`${this.admin}/${id}/notes`, { text }); }
  // The payout of a gateway (Stripe ...) reached the bank
  markPayout(orderIds: number[], reference: string | null): Observable<void> { return this.http.post<void>(`${this.admin}/payouts`, { orderIds, reference }); }
  // Card payment: the address of the Stripe page of an order the shop just placed (the token is the one of the confirmation page)
  createStripeSession(number: string, token: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.url}/${encodeURIComponent(number)}/stripe-session`, { token });
  }
  update(id: number, body: OrderUpdate): Observable<void> {
    return this.http.put<void>(`${this.admin}/${id}`, body);
  }
  getEmailTemplates(): Observable<OrderEmailTemplates> { return this.http.get<OrderEmailTemplates>(`${this.admin}/email-templates`); }
  saveEmailTemplates(b: OrderEmailTemplates): Observable<void> { return this.http.put<void>(`${this.admin}/email-templates`, b); }
  fulfil(id: number, warehouseId: number): Observable<void> {
    return this.http.post<void>(`${this.admin}/${id}/fulfil`, { warehouseId });
  }
}
