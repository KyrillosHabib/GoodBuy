// Mirrors the Voltara API contracts (camelCase JSON, enums as strings).

export type Language = 'en' | 'ar';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// ======================================================== public

export interface PublicCategory {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productsCount: number;
}

export interface PublicProductListItem {
  isBundle?: boolean;
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  brand: string | null;
  mainImageUrl: string | null;
  isFeatured: boolean;
  categorySlug: string;
  categoryName: string;
  price: number | null;
  compareAtPrice: number | null;
  // Several different prices among the variants: show "from"
  priceFrom: boolean;
  inStock: boolean;
  // One variant only and it can be bought: the card can add it directly
  purchasable: boolean;
  variantCount: number;
  defaultVariantId: number | null;
  // Colour swatches of the options
  colors?: string[];
}

export interface PublicBundleItem { name: string; variantLabel: string; quantity: number; imageUrl: string | null; slug: string; }

export interface PublicProductDetails {
  isBundle?: boolean;
  bundleItems?: PublicBundleItem[];
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  mainImageUrl: string | null;
  isFeatured: boolean;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  gallery: { url: string; altText: string | null }[];
  specifications: { name: string; value: string }[];
  variants: PublicVariant[];
}

export interface PublicVariantAttribute { name: string; value: string; colorHex: string | null; }

export interface PublicVariant {
  id: number;
  sku: string;
  label: string;
  attributes: PublicVariantAttribute[];
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  // In stock, or out of stock but open for pre-order
  canBuy: boolean;
  preorder: boolean;
  preorderLeadDays: number | null;
  // Units left when low (5 or fewer)
  lowStock: number | null;
}

export interface PublicContentItem {
  id: number;
  icon: string | null;
  imageUrl: string | null;
  value: string | null;
  title: string;
  description: string | null;
}

export interface PublicCompany {
  companyName: string;
  tagline: string | null;
  workingHours: string | null;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
  whatsAppNumber: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  mapEmbedUrl: string | null;
  socialLinks: { platform: string; url: string }[];
}

export interface PublicBrand { id: number; name: string; logoUrl: string | null; }

// One slide of the cover: its picture, and its own text and button (per language)
export interface HeroSlide {
  imageUrl: string;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  buttonLabel: Record<string, string>;
  buttonUrl: string | null;
}

export interface PublicSiteSettings {
  primaryColor: string;
  darkColor: string;
  secondaryColor: string;
  accentColor: string;
  // The cover under the header: one picture (heroImageUrl of the company page) or a slider of heroSlides
  heroMode: 'image' | 'slider';
  heroSlides: HeroSlide[];
  // The opening logo screen (off by default), how long it stays, the "request a quote" and "shop now" buttons, product reviews
  splashEnabled: boolean;
  splashSeconds: number;
  reviewsEnabled: boolean;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
  heroOverlay: number;
  fontScale: number;
  enableAnimations: boolean;
  faviconUrl: string | null;
  // The storefront layout (announcement strip, section order, colours, video, collage) as JSON - see core/storefront.ts
  storefrontJson: string | null;

  showLanguageSwitcher: boolean;
  showWhatsAppButton: boolean;


  showFooterAbout: boolean;
  showFooterQuickLinks: boolean;
  showFooterCategories: boolean;
  showFooterContact: boolean;
  showFooterSocials: boolean;
}

export interface Home {
  company: PublicCompany;
  settings: PublicSiteSettings;
  brands: PublicBrand[];
  features: PublicContentItem[];
  statistics: PublicContentItem[];
  categories: PublicCategory[];
  featuredProducts: PublicProductListItem[];
}

export interface SubmitInquiryRequest {
  name: string;
  company: string | null;
  country: string | null;
  email: string;
  phone: string | null;
  productId: number | null;
  message: string;
}

// ======================================================== auth

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  email: string;
  roles: string[];
  // The password was given by an administrator: it must be replaced before anything else
  mustChangePassword?: boolean;
  // What the user may open in the dashboard (the Admin role: everything)
  permissions?: string[];
}

// ======================================================== admin

export interface Translated { languageCode: string; }

export interface CategoryTranslation extends Translated { name: string; description: string | null; }

export interface CategoryInput {
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: CategoryTranslation[];
}

export interface CategoryAdmin extends CategoryInput { id: number; productsCount: number; }

export interface ProductTranslation extends Translated {
  name: string;
  shortDescription: string | null;
  description: string | null;
}

export interface ProductImage { url: string; altText: string | null; sortOrder: number; }

export interface SpecificationTranslation extends Translated { name: string; value: string; }

export interface Specification { sortOrder: number; translations: SpecificationTranslation[]; }

export interface ProductInput {
  categoryId: number;
  slug: string;
  sku: string | null;
  brandId: number | null;
  mainImageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  translations: ProductTranslation[];
  images: ProductImage[];
  specifications: Specification[];
  variants: VariantInput[];
  // A package: one item sold at one price, made of other items (see bundleItems of that item)
  isBundle?: boolean;
}

export interface ProductAdmin extends ProductInput { id: number; }

export interface ProductAdminListItem {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  categoryId: number;
  categoryName: string;
  brandName: string | null;
  mainImageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  // Cheapest variant, number of variants, units on hand in all warehouses
  price: number | null;
  variantCount: number;
  units: number;
}

export interface BrandInput {
  logoUrl: string | null;
  isActive: boolean;
  translations: { languageCode: string; name: string }[];
}

export interface BrandAdmin extends BrandInput {
  id: number;
  productsCount: number;
}

export interface SocialLink {
  platform: string;
  url: string;
  isVisible: boolean;
  sortOrder: number;
}

export interface SiteSettingsAdmin extends PublicSiteSettings {
  reviewsAutoApprove: boolean;
  featuredProductsLimit: number;
  skuPrefix: string;
  defaultLowStockThreshold: number;
  shippingFee: number;
  // JSON of the theme saved as "my default"
  defaultTheme: string | null;

  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  // write-only: empty keeps the stored password
  smtpPassword: string | null;
  hasSmtpPassword: boolean;
  smtpUseSsl: boolean;
  smtpAcceptAnyCertificate: boolean;
  mailFromEmail: string | null;
  mailFromName: string | null;
  notifyEmail: string | null;
  notifyOnInquiry: boolean;
  sendAutoReply: boolean;
}

export type ContentItemType = 'Feature' | 'Statistic';

export const CONTENT_ITEM_TYPES: ContentItemType[] = [
  'Feature', 'Statistic',
];

export interface ContentItemTranslation extends Translated { title: string; description: string | null; }

export interface ContentItemInput {
  type: ContentItemType;
  icon: string | null;
  imageUrl: string | null;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: ContentItemTranslation[];
}

export interface ContentItemAdmin extends ContentItemInput { id: number; }

export interface CompanyProfileTranslation extends Translated {
  companyName: string;
  tagline: string | null;
  workingHours: string | null;
  address: string | null;
}

export interface CompanyProfileInput {
  contactEmail: string | null;
  phone: string | null;
  whatsAppNumber: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  mapEmbedUrl: string | null;
  translations: CompanyProfileTranslation[];
  socialLinks: SocialLink[];
}

export type InquiryStatus = 'New' | 'Read' | 'Replied' | 'Archived';

export const INQUIRY_STATUSES: InquiryStatus[] = ['New', 'Read', 'Replied', 'Archived'];

export interface Inquiry {
  id: number;
  name: string;
  company: string | null;
  country: string | null;
  email: string;
  phone: string | null;
  productId: number | null;
  productName: string | null;
  message: string;
  status: InquiryStatus;
  adminNote: string | null;
  replyText: string | null;
  repliedAtUtc: string | null;
  createdAtUtc: string;
}

// ---------------------------------------------------------------- customer accounts

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
}

// Answer of register / forgot-password / resend-otp
export interface OtpInfo {
  email?: string;
  codeExpiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  language: string;
  emailConfirmed: boolean;
  createdAtUtc: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone: string | null;
  language: string;
}

export interface Address {
  id: number;
  label: string | null;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  region: string | null;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id'>;

// ---------------------------------------------------------------- shop: cart

export interface PaymentMethodInfo { code: string; enabled: boolean; }

export interface StoreInfo { currency: string; paymentMethods: PaymentMethodInfo[]; }

export type CartIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export interface CartLine {
  // A free gift from an offer: it costs nothing and cannot be changed
  isGift?: boolean;
  promotionName?: string | null;
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  // "250 ml / Black"
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  availableStock: number | null;
  // Out of stock but taken as a pre-order
  preorder: boolean;
  preorderLeadDays: number | null;
  issue: CartIssue | null;
}

export interface Cart {
  // Guests only: kept in the browser and sent back as the X-Cart-Token header
  guestToken: string | null;
  currency: string;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  savings: number;
  hasIssues: boolean;
  // The coupon applied, what it takes off, and why it does not work any more (null = it works)
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  // What the customer pays: subtotal - couponDiscount
  total: number;
  // The coupon applied removes the shipping fee
  couponFreeShipping?: boolean;
  // What the offers took off, the shipping fee (0 = free) and the names of the offers that were applied
  promotionDiscount: number;
  shippingFee: number;
  appliedPromotions: string[];
}

// ---------------------------------------------------------------- catalogue: variants (admin)

export interface VariantAttribute {
  // languageCode -> text
  name: Record<string, string>;
  value: Record<string, string>;
  colorHex: string | null;
}

export interface VariantInput {
  id: number | null;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  trackStock: boolean;
  allowPreorder: boolean;
  preorderLeadDays: number | null;
  imageUrl: string | null;
  sortOrder: number;
  attributes: VariantAttribute[];
  lowStockThreshold: number;
  // Only for a package: its components
  bundleItems?: { variantId: number; quantity: number; label?: string | null }[] | null;
  // Empty = the system makes one when the product is saved
  barcode?: string | null;
}

// ---------------------------------------------------------------- inventory (admin)

export interface Warehouse { id: number; name: string; code: string; address: string | null; isActive: boolean; items: number; units: number; nameEn: string; nameAr: string | null; }
export interface WarehouseInput { name: string; nameAr: string | null; code: string | null; address: string | null; isActive: boolean; }
export interface StaffMember { id: string; email: string; userName?: string; fullName: string; isActive: boolean; warehouseIds: number[]; role: string; managerWarehouseIds?: number[]; }

// A role and what it can open in the dashboard
export type DiscountType = 'Percent' | 'FixedAmount' | 'SetPrice';
export type DiscountScope = 'AllProducts' | 'Category' | 'Product' | 'Variant';

export interface Discount {
  id: number; name: string; type: DiscountType; value: number; scope: DiscountScope;
  categoryId: number | null; productId: number | null; variantId: number | null; target: string;
  startsAtUtc: string | null; endsAtUtc: string | null; isActive: boolean; status: 'active' | 'scheduled' | 'ended' | 'off';
}
export type DiscountInput = Omit<Discount, 'id' | 'target' | 'status'>;

export type PromotionType = 'BuyGet' | 'QuantityDiscount' | 'SpendGift' | 'FreeShipping';

export interface Promotion {
  id: number; name: string; type: PromotionType; triggerScope: DiscountScope;
  triggerCategoryId: number | null; triggerProductId: number | null; triggerVariantId: number | null;
  buyQuantity: number; minSubtotal: number | null; rewardVariantId: number | null; rewardQuantity: number; repeat: boolean;
  discountType: 'Percent' | 'FixedAmount'; discountValue: number; startsAtUtc: string | null; endsAtUtc: string | null; isActive: boolean;
  triggerTarget: string; rewardName: string; status: 'active' | 'scheduled' | 'ended' | 'off';
}
export type PromotionInput = Omit<Promotion, 'id' | 'triggerTarget' | 'rewardName' | 'status'>;

export interface Coupon {
  id: number; code: string; name: string; type: 'Percent' | 'FixedAmount' | 'FreeShipping'; value: number;
  minOrderAmount: number | null; maxDiscountAmount: number | null; startsAtUtc: string | null; endsAtUtc: string | null;
  isActive: boolean; totalUsageLimit: number | null; perCustomerLimit: number | null; usedCount: number;
  audience: 'Everyone' | 'SpecificCustomers' | 'NewCustomers'; allowedEmails: string | null; excludeDiscountedItems: boolean;
  categoryId: number | null; productId: number | null; target: string; status: 'active' | 'scheduled' | 'ended' | 'exhausted' | 'off';
}
export type CouponInput = Omit<Coupon, 'id' | 'usedCount' | 'target' | 'status'>;
export interface CouponUsage { orderNumber: string; email: string; amount: number; usedAtUtc: string; }

export interface RoleInfo { name: string; isSystem: boolean; users: number; permissions: string[]; }
export interface RolesResponse { roles: RoleInfo[]; allPermissions: string[]; }

export interface StockRow {
  warehouseId: number; warehouseName: string; variantId: number; sku: string; productName: string; label: string;
  onHand: number; reorderLevel: number; averageCost: number; value: number; price: number; isLow: boolean;
}

export interface VariantPick { id: number; sku: string; productName: string; label: string; price: number; productId?: number; barcode?: string | null; }

export interface Movement {
  id: number; createdAtUtc: string; warehouseName: string; sku: string; productName: string; label: string; type: string;
  quantity: number; unitCost: number; balanceAfter: number; reference: string | null; note: string | null;
  userName: string | null; batchNumber: string | null; expiryDate: string | null;
}

export interface Batch {
  id: number; warehouseId: number; warehouseName: string; sku: string; productName: string; label: string; batchNumber: string;
  receivedAtUtc: string; expiryDate: string | null; unitCost: number; quantityReceived: number; quantityRemaining: number;
  daysToExpiry: number | null;
}

export interface InventorySummary {
  totalUnits: number; totalValue: number; lowStockItems: number; expiringSoonBatches: number; expiredBatches: number;
  waitingCustomers: number; reservedUnits: number;
}

export interface WaitingItem { variantId: number; sku: string; productName: string; label: string; waiting: number; }

export interface Supplier { id: number; name: string; nameEn: string; nameAr: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null; isActive: boolean; }
export type SupplierInput = Omit<Supplier, 'id' | 'nameEn'>;

export interface PurchaseOrderLine {
  id: number; variantId: number; sku: string; productName: string; label: string;
  quantityOrdered: number; quantityReceived: number; unitCost: number;
}

export interface PurchaseOrder {
  id: number; number: string; supplierId: number; supplierName: string; warehouseId: number; warehouseName: string;
  status: 'Draft' | 'Ordered' | 'PartiallyReceived' | 'Received' | 'Cancelled';
  createdAtUtc: string; expectedAtUtc: string | null; notes: string | null; total: number; lines: PurchaseOrderLine[];
}

export interface PurchaseOrderInput {
  supplierId: number; warehouseId: number; expectedAtUtc: string | null; notes: string | null;
  lines: { variantId: number; quantity: number; unitCost: number }[];
}

export interface ReceiveLineInput { lineId: number; quantity: number; batchNumber: string | null; expiryDate: string | null; }

export interface StockCount {
  id: number; warehouseId: number; warehouseName: string; status: 'Open' | 'Completed' | 'Cancelled';
  createdAtUtc: string; completedAtUtc: string | null; note: string | null; lines: number;
}
export interface StockCountLine { variantId: number; sku: string; productName: string; label: string; expectedQuantity: number; countedQuantity: number | null; }
export interface StockCountDetail { header: StockCount; lines: StockCountLine[]; }

// ---------------------------------------------------------------- shop: orders

export interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  region: string | null;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  notes: string | null;
  paymentMethod: string;
}

export interface PlacedOrder { number: string; accessToken: string; total: number; currency: string; paymentMethod: string; }

export interface OrderItem {
  variantId: number; productName: string; variantLabel: string; sku: string; unitPrice: number; quantity: number; lineTotal: number;
  isPreorder: boolean; preorderLeadDays: number | null; costTotal: number | null;
  // The id of the line, its warehouse and where it stands in the warehouse (the dashboard only)
  id?: number; warehouseId?: number | null; fulfilmentStatus?: string; fulfilmentNote?: string | null;
}

export interface Order {
  id: number; number: string; status: string; paymentMethod: string; paymentStatus: string; createdAtUtc: string; currency: string;
  subtotal: number; savings: number; total: number; customerName: string; email: string; phone: string; country: string; city: string;
  region: string | null; line1: string; line2: string | null; postalCode: string | null; notes: string | null; isGuest: boolean;
  fulfilledFromWarehouseId: number | null; items: OrderItem[]; estimatedDeliveryDays: number | null; couponCode: string | null; couponDiscount: number;
  // Worked out by the API: how far the warehouses are, and the money recorded on the order
  fulfilmentStatus?: string; paidAmount?: number; refundedAmount?: number;
  promotionDiscount?: number; shippingFee?: number;
  // Shipping: the company and the tracking number (dashboard only)
  shippingCarrierId?: number | null; shippingCarrierName?: string | null; trackingNumber?: string | null;
  // None | Pending | Settled: has the money held by the shipping company / the gateway reached us? (dashboard only)
  settlementStatus?: 'None' | 'Pending' | 'Settled';
  // Auction orders: made for the winner, to be paid (or cash on delivery chosen) before payByUtc
  payByUtc?: string | null; auctionId?: number | null;
}

// The winner's answer on his auction order: the delivery details and how he pays
export interface AuctionOrderForm {
  paymentMethod: 'CashOnDelivery' | 'Card'; fullName: string; phone: string; country: string; city: string; region: string | null; line1: string; line2?: string | null; postalCode?: string | null;
}

// What the dashboard sends when it saves an order (status / payment + what the status e-mail needs)
export interface OrderUpdate {
  status?: string | null; paymentStatus?: string | null; deliveryDays?: number | null; note?: string | null; sendEmail?: boolean;
  carrierId?: number | null; trackingNumber?: string | null;
}

// The e-mail the customer gets when the order reaches a status (texts per language code)
export interface OrderEmailTemplate { enabled: boolean; subject: Record<string, string>; body: Record<string, string>; }
export interface OrderEmailTemplates { templates: Record<string, OrderEmailTemplate>; }

export interface ReturnPolicy {
  enabled: boolean;
  returnsAllowed: boolean; returnWindowDays: number;
  exchangeAllowed: boolean; exchangeWindowDays: number;
  refundMethod: 'original' | 'storeCredit' | 'none';
  shippingPaidBy: 'customer' | 'store' | 'storeIfDefective';
  requireOriginalPackaging: boolean; defectiveOnly: boolean;
  conditions: Record<string, string>;
}

// ---------- auctions
export interface PublicAuction {
  id: number; productSlug: string; productName: string; variantLabel: string; imageUrl: string | null; isBundle: boolean; quantity: number;
  startingPrice: number; currentPrice: number; bidCount: number; minNextBid: number; startsAtUtc: string; endsAtUtc: string;
  status: 'scheduled' | 'running' | 'ended'; result: 'sold' | 'no_sale' | null; reserveMet: boolean | null; isLeading: boolean; serverNowUtc: string;
  items?: AuctionItem[];
  // The most the signed-in user bid here (null = never bid)
  myBestBid?: number | null;
}
export interface AuctionItem { variantId: number; name: string; label: string; imageUrl: string | null; quantity: number; }
export interface PublicBid { bidder: string; amount: number; placedAtUtc: string; }
export interface PublicAuctionDetails { auction: PublicAuction; bids: PublicBid[]; shortDescription: string | null; }

export interface AuctionAdmin {
  id: number; variantId: number; itemName: string; quantity: number; startingPrice: number; minIncrement: number; reservePrice: number | null;
  startsAtUtc: string; endsAtUtc: string; status: 'scheduled' | 'running' | 'ended' | 'cancelled'; result: 'sold' | 'no_sale' | null;
  currentPrice: number; bidCount: number; winnerName: string | null; winnerEmail: string | null; isBundle: boolean;
  title?: string | null; imageUrl?: string | null; items?: AuctionItem[];
}
export interface AuctionInput {
  variantId: number; quantity: number; startingPrice: number; minIncrement: number; reservePrice: number | null; startsAtUtc: string; endsAtUtc: string;
  title?: string | null; imageUrl?: string | null; items?: { variantId: number; quantity: number }[];
}
export interface AuctionBidAdmin { name: string; email: string; amount: number; placedAtUtc: string; }

// ---------- wheel of fortune
export type WheelPrizeKind = 'NoPrize' | 'Percent' | 'FixedAmount' | 'FreeShipping';
export interface WheelSliceView { id: number; label: string; color: string | null; kind: WheelPrizeKind; }
export interface WheelCoupon { code: string; prize: string; expiresAtUtc: string; }
export interface WheelPublic {
  enabled: boolean; campaignId: number | null; showDelaySeconds: number; needsEmail: boolean; spinsLeft: number;
  slices: WheelSliceView[]; lastCoupon: WheelCoupon | null;
}
export interface WheelSpinResult { sliceId: number; label: string; kind: WheelPrizeKind; value: number; coupon: WheelCoupon | null; spinsLeft: number; }

export interface WheelSliceInput { label: string; labelAr: string | null; kind: WheelPrizeKind; value: number; probability: number; color: string | null; }
export interface WheelCampaignInput {
  name: string; isActive: boolean; startsAtUtc: string | null; endsAtUtc: string | null; showDelaySeconds: number;
  audience: 'AllVisitors' | 'NewVisitors' | 'SpecificCustomers'; allowedEmails: string | null; maxSpinsPerVisitor: number; maxSpinsPerIp: number;
  couponValidityDays: number; maxDiscountAmount: number | null; minOrderAmount: number | null; requireEmail: boolean; slices: WheelSliceInput[];
}
export interface WheelStats { spins: number; prizes: number; couponsUsed: number; sales: number; }
export interface WheelCampaign extends WheelCampaignInput { id: number; status: 'active' | 'scheduled' | 'ended' | 'off'; stats: WheelStats; }

// ---------- shop filters
export interface FacetCategory { slug: string; name: string; count: number; }
export interface FacetBrand { id: number; name: string; count: number; }
export interface FacetValue { value: string; colorHex: string | null; count: number; }
export interface FacetAttribute { name: string; values: FacetValue[]; }
export interface ProductFacets { minPrice: number; maxPrice: number; categories: FacetCategory[]; brands: FacetBrand[]; attributes: FacetAttribute[]; }

// ---------- product reviews
export interface ProductReview { name: string; rating: number; comment: string; createdAtUtc: string; verified: boolean; reply: string | null; }
export interface ProductReviews { enabled: boolean; average: number; count: number; distribution: number[]; items: ProductReview[]; alreadyReviewed: boolean; }
export interface ReviewAdmin { id: number; productName: string; productSlug: string; name: string; email: string; rating: number; comment: string; verified: boolean; isApproved: boolean; reply: string | null; createdAtUtc: string; }
