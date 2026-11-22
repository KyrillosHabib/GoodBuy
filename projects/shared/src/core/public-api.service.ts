import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  Home,
  PagedResult,
  PublicCategory,
  PublicProductDetails,
  PublicAuction,
  PublicAuctionDetails,
  ProductFacets,
  ProductReviews,
  PublicProductListItem,
  ReturnPolicy,
  WheelPublic,
  WheelSpinResult,
  SubmitInquiryRequest,
} from './models';

export interface ProductsFilter {
  category?: string;
  brand?: number;
  search?: string;
  featured?: boolean;
  // the side filters of the shop
  categories?: string[];
  brands?: number[];
  minPrice?: number;
  maxPrice?: number;
  // "Color|Black": one entry per chosen value
  attr?: string[];
  inStock?: boolean;
  onSale?: boolean;
  bundles?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/public`;

  // The wheel of fortune: the browser only says WHO it is (a random token kept in the browser); the result is drawn by the server
  getWheel(token: string, email?: string): Observable<WheelPublic> {
    return this.http.get<WheelPublic>(`${this.baseUrl}/wheel`, {
      headers: { 'X-Visitor-Token': token },
      params: email ? { email } : {},
    });
  }

  spinWheel(token: string, email?: string): Observable<WheelSpinResult> {
    return this.http.post<WheelSpinResult>(`${this.baseUrl}/wheel/spin`, { email: email || null }, { headers: { 'X-Visitor-Token': token } });
  }

  getAuctions(): Observable<PublicAuction[]> {
    return this.http.get<PublicAuction[]>(`${this.baseUrl}/auctions`);
  }

  getAuction(id: number): Observable<PublicAuctionDetails> {
    return this.http.get<PublicAuctionDetails>(`${this.baseUrl}/auctions/${id}`);
  }

  bid(id: number, amount: number): Observable<PublicAuction> {
    return this.http.post<PublicAuction>(`${this.baseUrl}/auctions/${id}/bids`, { amount });
  }

  getReturnPolicy(): Observable<ReturnPolicy> {
    return this.http.get<ReturnPolicy>(`${this.baseUrl}/return-policy`);
  }

  // The end of the running offer (null = no offer with an end date): the storefront counts down to it
  getCurrentOffer(): Observable<{ endsAtUtc: string | null }> {
    return this.http.get<{ endsAtUtc: string | null }>(`${this.baseUrl}/offers/current`);
  }

  getHome(): Observable<Home> {
    return this.http.get<Home>(`${this.baseUrl}/home`);
  }

  getCategories(): Observable<PublicCategory[]> {
    return this.http.get<PublicCategory[]>(`${this.baseUrl}/categories`);
  }

  getProducts(filter: ProductsFilter): Observable<PagedResult<PublicProductListItem>> {
    let params = new HttpParams();

    if (filter.category) params = params.set('category', filter.category);
    if (filter.brand) params = params.set('brand', filter.brand);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.featured) params = params.set('featured', true);
    for (const c of filter.categories ?? []) params = params.append('categories', c);
    for (const b of filter.brands ?? []) params = params.append('brands', b);
    for (const a of filter.attr ?? []) params = params.append('attr', a);
    if (filter.minPrice !== undefined) params = params.set('minPrice', filter.minPrice);
    if (filter.maxPrice !== undefined) params = params.set('maxPrice', filter.maxPrice);
    if (filter.inStock) params = params.set('inStock', true);
    if (filter.onSale) params = params.set('onSale', true);
    if (filter.bundles) params = params.set('bundles', true);
    if (filter.sort) params = params.set('sort', filter.sort);
    if (filter.page) params = params.set('page', filter.page);
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize);

    return this.http.get<PagedResult<PublicProductListItem>>(`${this.baseUrl}/products`, { params });
  }

  // The price range, categories, brands and options the shop can be filtered by
  getFacets(): Observable<ProductFacets> {
    return this.http.get<ProductFacets>(`${this.baseUrl}/products/facets`);
  }

  getReviews(slug: string): Observable<ProductReviews> {
    return this.http.get<ProductReviews>(`${this.baseUrl}/products/${slug}/reviews`);
  }

  // true = published at once, false = waits for the owner's approval
  submitReview(slug: string, rating: number, comment: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/products/${slug}/reviews`, { rating, comment });
  }

  getProduct(slug: string): Observable<PublicProductDetails> {
    return this.http.get<PublicProductDetails>(`${this.baseUrl}/products/${encodeURIComponent(slug)}`);
  }

  submitInquiry(request: SubmitInquiryRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/inquiries`, request);
  }

  // "Tell me when it is back in stock"
  requestStockNotification(variantId: number, email: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/public/stock-notifications`, { variantId, email });
  }
}
