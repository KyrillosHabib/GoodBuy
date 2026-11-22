import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  BrandAdmin,
  BrandInput,
  CategoryAdmin,
  CategoryInput,
  CompanyProfileInput,
  ContentItemAdmin,
  ContentItemInput,
  ContentItemType,
  Inquiry,
  InquiryStatus,
  PagedResult,
  ProductAdmin,
  ProductAdminListItem,
  ProductInput,
  AuctionAdmin,
  AuctionBidAdmin,
  ReviewAdmin,
  WheelCampaign,
  WheelCampaignInput,
  AuctionInput,
  Coupon,
  CouponInput,
  CouponUsage,
  Discount,
  DiscountInput,
  Promotion,
  PromotionInput,
  ReturnPolicy,
  RolesResponse,
  SiteSettingsAdmin,
} from './models';

// Every /api/admin/* endpoint (all require the Admin role)
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/admin`;

  // ---------------- categories
  getCategories(): Observable<CategoryAdmin[]> {
    return this.http.get<CategoryAdmin[]>(`${this.baseUrl}/categories`);
  }

  createCategory(input: CategoryInput): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/categories`, input);
  }

  updateCategory(id: number, input: CategoryInput): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/categories/${id}`, input);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${id}`);
  }

  // ---------------- brands
  getBrands(): Observable<BrandAdmin[]> {
    return this.http.get<BrandAdmin[]>(`${this.baseUrl}/brands`);
  }

  createBrand(input: BrandInput): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/brands`, input);
  }

  updateBrand(id: number, input: BrandInput): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/brands/${id}`, input);
  }

  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/brands/${id}`);
  }

  // ---------------- discounts and coupons
  getDiscounts(): Observable<Discount[]> { return this.http.get<Discount[]>(`${this.baseUrl}/discounts`); }
  createDiscount(b: DiscountInput): Observable<number> { return this.http.post<number>(`${this.baseUrl}/discounts`, b); }
  updateDiscount(id: number, b: DiscountInput): Observable<void> { return this.http.put<void>(`${this.baseUrl}/discounts/${id}`, b); }
  deleteDiscount(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/discounts/${id}`); }

  getReviews(): Observable<ReviewAdmin[]> { return this.http.get<ReviewAdmin[]>(`${this.baseUrl}/reviews`); }
  moderateReview(id: number, action: 'approve' | 'hide' | 'delete' | 'reply', reply?: string | null): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reviews/${id}`, { action, reply: reply ?? null });
  }

  getWheelCampaigns(): Observable<WheelCampaign[]> { return this.http.get<WheelCampaign[]>(`${this.baseUrl}/wheel`); }
  createWheelCampaign(b: WheelCampaignInput): Observable<number> { return this.http.post<number>(`${this.baseUrl}/wheel`, b); }
  updateWheelCampaign(id: number, b: WheelCampaignInput): Observable<void> { return this.http.put<void>(`${this.baseUrl}/wheel/${id}`, b); }
  deleteWheelCampaign(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/wheel/${id}`); }

  getAuctions(): Observable<AuctionAdmin[]> { return this.http.get<AuctionAdmin[]>(`${this.baseUrl}/auctions`); }
  getAuctionBids(id: number): Observable<AuctionBidAdmin[]> { return this.http.get<AuctionBidAdmin[]>(`${this.baseUrl}/auctions/${id}/bids`); }
  createAuction(b: AuctionInput): Observable<number> { return this.http.post<number>(`${this.baseUrl}/auctions`, b); }
  updateAuction(id: number, b: AuctionInput): Observable<void> { return this.http.put<void>(`${this.baseUrl}/auctions/${id}`, b); }
  cancelAuction(id: number): Observable<void> { return this.http.post<void>(`${this.baseUrl}/auctions/${id}/cancel`, {}); }

  getPromotions(): Observable<Promotion[]> { return this.http.get<Promotion[]>(`${this.baseUrl}/promotions`); }
  createPromotion(b: PromotionInput): Observable<number> { return this.http.post<number>(`${this.baseUrl}/promotions`, b); }
  updatePromotion(id: number, b: PromotionInput): Observable<void> { return this.http.put<void>(`${this.baseUrl}/promotions/${id}`, b); }
  deletePromotion(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/promotions/${id}`); }

  getCoupons(): Observable<Coupon[]> { return this.http.get<Coupon[]>(`${this.baseUrl}/coupons`); }
  getCouponUsages(id: number): Observable<CouponUsage[]> { return this.http.get<CouponUsage[]>(`${this.baseUrl}/coupons/${id}/usages`); }
  createCoupon(b: CouponInput): Observable<number> { return this.http.post<number>(`${this.baseUrl}/coupons`, b); }
  updateCoupon(id: number, b: CouponInput): Observable<void> { return this.http.put<void>(`${this.baseUrl}/coupons/${id}`, b); }
  deleteCoupon(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/coupons/${id}`); }

  // ---------------- roles
  getRoles(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>(`${this.baseUrl}/roles`);
  }

  saveRole(body: { name: string; permissions: string[]; isNew: boolean }): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/roles`, body);
  }

  deleteRole(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${encodeURIComponent(name)}`);
  }

  // ---------------- returns and exchange policy
  getReturnPolicy(): Observable<ReturnPolicy> {
    return this.http.get<ReturnPolicy>(`${this.baseUrl}/return-policy`);
  }

  saveReturnPolicy(input: ReturnPolicy): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/return-policy`, input);
  }

  // ---------------- site settings (theme, sections, email ...)
  getSettings(): Observable<SiteSettingsAdmin> {
    return this.http.get<SiteSettingsAdmin>(`${this.baseUrl}/settings`);
  }

  updateSettings(input: SiteSettingsAdmin): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/settings`, input);
  }

  sendTestEmail(to: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/settings/test-email`, { to });
  }

  // ---------------- products
  getProducts(filter: { search?: string; categoryId?: number | null; bundles?: boolean; page: number; pageSize: number }):
    Observable<PagedResult<ProductAdminListItem>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);

    if (filter.search) params = params.set('search', filter.search);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    if (filter.bundles !== undefined) params = params.set('bundles', filter.bundles);

    return this.http.get<PagedResult<ProductAdminListItem>>(`${this.baseUrl}/products`, { params });
  }

  getProduct(id: number): Observable<ProductAdmin> {
    return this.http.get<ProductAdmin>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(input: ProductInput): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/products`, input);
  }

  updateProduct(id: number, input: ProductInput): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/products/${id}`, input);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }

  // ---------------- content items (services, features, steps, ...)
  getContentItems(type?: ContentItemType | null): Observable<ContentItemAdmin[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);

    return this.http.get<ContentItemAdmin[]>(`${this.baseUrl}/content-items`, { params });
  }

  createContentItem(input: ContentItemInput): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/content-items`, input);
  }

  updateContentItem(id: number, input: ContentItemInput): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/content-items/${id}`, input);
  }

  deleteContentItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/content-items/${id}`);
  }

  // ---------------- company profile
  getCompanyProfile(): Observable<CompanyProfileInput> {
    return this.http.get<CompanyProfileInput>(`${this.baseUrl}/company-profile`);
  }

  updateCompanyProfile(input: CompanyProfileInput): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/company-profile`, input);
  }

  // ---------------- inquiries
  getInquiries(filter: { status?: InquiryStatus | ''; page: number; pageSize: number }):
    Observable<PagedResult<Inquiry>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.status) params = params.set('status', filter.status);

    return this.http.get<PagedResult<Inquiry>>(`${this.baseUrl}/inquiries`, { params });
  }

  // Opening a "New" inquiry marks it as "Read" on the server
  getInquiry(id: number): Observable<Inquiry> {
    return this.http.get<Inquiry>(`${this.baseUrl}/inquiries/${id}`);
  }

  updateInquiryStatus(id: number, status: InquiryStatus, adminNote: string | null): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/inquiries/${id}/status`, { status, adminNote });
  }

  replyInquiry(id: number, subject: string, message: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/inquiries/${id}/reply`, { subject, message });
  }

  deleteInquiry(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/inquiries/${id}`);
  }

  // ---------------- media
  uploadImage(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append('file', file);

    return this.http.post<{ url: string }>(`${this.baseUrl}/media/images`, body);
  }

  // A video for the home page video section, stored on the server (MP4 / WebM)
  uploadVideo(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append('file', file);

    return this.http.post<{ url: string }>(`${this.baseUrl}/media/videos`, body);
  }
}
