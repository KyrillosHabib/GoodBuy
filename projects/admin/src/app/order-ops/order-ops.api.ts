import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@shared/environments/environment';

// The three workflows that sit between the shop and the warehouses:
//   1. fulfilment: the lines of a confirmed order become tasks for warehouses
//   2. customer returns: goods a customer sends back (receive -> check -> approve -> stock)
//   3. stock adjustments: a difference between the shelf and the books, approved by the head of the warehouse
// The API sends enums as their names (strings).

// ---------------------------------------------------------------- fulfilment

export type ItemFulfilmentStatus = 'NotStarted' | 'Picking' | 'Fulfilled' | 'Problem' | 'NotRequired';
export type OrderFulfilmentStatus = 'NotRequired' | 'NeedsAllocation' | 'Allocated' | 'InProgress' | 'Partial' | 'ReadyToShip' | 'Problem';

export interface FulfilmentItem {
  itemId: number; variantId: number; productName: string; variantLabel: string; sku: string; quantity: number; isPreorder: boolean;
  warehouseId: number | null; warehouse: string | null; status: ItemFulfilmentStatus; note: string | null;
  onHand: number | null; mine: boolean; fulfilledAtUtc: string | null; fulfilledBy: string | null;
}

export interface FulfilmentOrder {
  id: number; number: string; createdAtUtc: string; customerName: string; city: string; orderStatus: string; paymentStatus: string;
  status: OrderFulfilmentStatus; items: FulfilmentItem[]; phone: string; address: string; notes: string | null; paymentMethod: string;
}

// One box of the screen: how many orders, the oldest one, and which warehouses hold them
export interface FulfilmentGroup { count: number; oldestUtc: string | null; warehouses: { name: string; count: number }[]; }
export type FulfilmentGroupKey = 'new' | 'working' | 'ready' | 'problem' | 'late';

export interface FulfilmentBoard {
  counts: Record<string, number>; orders: FulfilmentOrder[]; canAllocate: boolean; warehouses: { id: number; name: string }[];
  groups: Record<FulfilmentGroupKey, FulfilmentGroup>; carriers: { id: number; name: string }[];
}

export interface OrderEvent { type: string; message: string; userName: string | null; createdAtUtc: string; }
export interface OrderPayment { id: number; kind: 'Payment' | 'Refund' | 'Failed'; amount: number; reference: string | null; note: string | null; userName: string | null; createdAtUtc: string; }
export interface OrderReturnSummary { id: number; number: string; status: CustomerReturnStatus; units: number; createdAtUtc: string; }
export interface OrderTimeline { events: OrderEvent[]; payments: OrderPayment[]; returns: OrderReturnSummary[]; }

// ---------------------------------------------------------------- customer returns

export type CustomerReturnStatus = 'Requested' | 'Returned' | 'Inspection' | 'AwaitingApproval' | 'Quarantine' | 'Completed' | 'Cancelled';
export type ReturnDisposition = 'Pending' | 'Restock' | 'Damaged' | 'Quarantine';

export interface CustomerReturnLine {
  id: number; orderItemId: number; variantId: number; productName: string; variantLabel: string; sku: string; warehouseId: number; warehouse: string;
  quantity: number; disposition: ReturnDisposition; condition: string | null; applied: boolean;
}

export interface CustomerReturnCan { receive: boolean; inspect: boolean; approve: boolean; reject: boolean; resolve: boolean; cancel: boolean; }

export interface CustomerReturn {
  id: number; number: string; orderId: number; orderNumber: string; customerName: string; status: CustomerReturnStatus; reason: string | null; note: string | null;
  createdAtUtc: string; createdBy: string | null; receivedBy: string | null; receivedAtUtc: string | null; inspectedBy: string | null; inspectedAtUtc: string | null;
  approvedBy: string | null; approvedAtUtc: string | null; rejectionReason: string | null; completedAtUtc: string | null;
  lines: CustomerReturnLine[]; can: CustomerReturnCan;
}

export interface CustomerReturnListItem {
  id: number; number: string; orderId: number; orderNumber: string; customerName: string; status: CustomerReturnStatus; lines: number; units: number;
  createdAtUtc: string; createdBy: string | null;
}

export interface CustomerReturnList { items: CustomerReturnListItem[]; counts: { toReceive: number; toInspect: number; toApprove: number; quarantine: number }; }

// ---------------------------------------------------------------- stock adjustments

export type StockAdjustmentStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type StockAdjustmentSource = 'Manual' | 'Count' | 'CustomerReturn';
export type AdjustmentReason = 'Shortage' | 'Surplus' | 'Damage' | 'Expired' | 'LostOrStolen' | 'CountError' | 'CustomerReturn' | 'Other';

export interface StockAdjustmentLine {
  id: number; variantId: number; sku: string; item: string; label: string; systemQuantity: number; actualQuantity: number; difference: number;
  reason: AdjustmentReason; note: string | null; appliedDifference: number | null; onHandNow: number;
}

export interface StockAdjustment {
  id: number; number: string; warehouseId: number; warehouse: string; status: StockAdjustmentStatus; source: StockAdjustmentSource; countId: number | null; note: string | null;
  createdAtUtc: string; createdBy: string | null; approvedBy: string | null; approvedAtUtc: string | null; rejectionReason: string | null;
  lines: StockAdjustmentLine[]; can: { approve: boolean; reject: boolean; cancel: boolean };
}

export interface StockAdjustmentListItem {
  id: number; number: string; warehouse: string; status: StockAdjustmentStatus; source: StockAdjustmentSource; lines: number; netUnits: number;
  createdAtUtc: string; createdBy: string | null; approvedBy: string | null;
}

export interface StockAdjustmentList { items: StockAdjustmentListItem[]; toApprove: number; }

export interface AdjustmentInput { variantId: number; actualQuantity: number; reason: AdjustmentReason; note: string | null; }

@Injectable({ providedIn: 'root' })
export class OrderOpsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin`;

  private params(values: Record<string, string | number | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  // ---------- fulfilment
  getBoard(f: { view?: string; warehouseId?: number | null; search?: string }): Observable<FulfilmentBoard> {
    return this.http.get<FulfilmentBoard>(`${this.base}/fulfilment`, { params: this.params({ view: f.view, warehouseId: f.warehouseId, search: f.search }) });
  }
  allocate(orderId: number, lines: { itemId: number; warehouseId: number }[]): Observable<void> {
    return this.http.post<void>(`${this.base}/fulfilment/orders/${orderId}/allocate`, { lines });
  }
  startPicking(orderId: number, itemIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.base}/fulfilment/orders/${orderId}/start`, { itemIds });
  }
  // The prepared orders go to a shipping company (they become "Shipped")
  handOver(orderIds: number[], carrierId: number, trackingNumber: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/fulfilment/hand-over`, { orderIds, carrierId, trackingNumber });
  }
  issueItems(orderId: number, itemIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.base}/fulfilment/orders/${orderId}/issue`, { itemIds });
  }
  reportProblem(orderId: number, itemId: number, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/fulfilment/orders/${orderId}/items/${itemId}/problem`, { note });
  }

  // The shipping companies an order can be handed to
  getCarriers(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(`${this.base}/orders/carriers`);
  }

  // ---------- the order: timeline and payments
  getTimeline(orderId: number): Observable<OrderTimeline> {
    return this.http.get<OrderTimeline>(`${this.base}/orders/${orderId}/timeline`);
  }
  recordPayment(orderId: number, b: { kind: 'Payment' | 'Refund' | 'Failed'; amount: number; reference: string | null; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/orders/${orderId}/payments`, b);
  }
  // Gives money back to the customer's card through Stripe (amount null = all that can be refunded)
  refundToCard(orderId: number, b: { amount: number | null; reason: string | null }): Observable<{ amount: number; currency: string; reference: string; status: string; remaining: number }> {
    return this.http.post<{ amount: number; currency: string; reference: string; status: string; remaining: number }>(`${this.base}/orders/${orderId}/refund`, b);
  }
  // Asks for a return of chosen order lines (orderItemId = the id of the line)
  requestReturn(orderId: number, b: { lines: { orderItemId: number; quantity: number }[]; reason: string | null; note: string | null }): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/orders/${orderId}/return`, b);
  }

  // ---------- customer returns
  getReturns(f: { view?: string; status?: string; search?: string }): Observable<CustomerReturnList> {
    return this.http.get<CustomerReturnList>(`${this.base}/customer-returns`, { params: this.params(f) });
  }
  getReturn(id: number): Observable<CustomerReturn> { return this.http.get<CustomerReturn>(`${this.base}/customer-returns/${id}`); }
  receiveReturn(id: number): Observable<void> { return this.http.post<void>(`${this.base}/customer-returns/${id}/receive`, {}); }
  inspectReturn(id: number, lines: { lineId: number; disposition: ReturnDisposition; condition: string | null }[], submit: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/customer-returns/${id}/inspect`, { lines, submit });
  }
  approveReturn(id: number): Observable<void> { return this.http.post<void>(`${this.base}/customer-returns/${id}/approve`, {}); }
  rejectReturn(id: number, reason: string): Observable<void> { return this.http.post<void>(`${this.base}/customer-returns/${id}/reject`, { reason }); }
  resolveQuarantine(lineId: number, disposition: 'Restock' | 'Damaged'): Observable<void> {
    return this.http.post<void>(`${this.base}/customer-returns/lines/${lineId}/resolve`, { disposition });
  }
  cancelReturn(id: number): Observable<void> { return this.http.post<void>(`${this.base}/customer-returns/${id}/cancel`, {}); }

  // ---------- stock adjustments
  getAdjustments(f: { view?: string; status?: string; warehouseId?: number | null; search?: string }): Observable<StockAdjustmentList> {
    return this.http.get<StockAdjustmentList>(`${this.base}/stock-adjustments`, { params: this.params(f) });
  }
  getAdjustment(id: number): Observable<StockAdjustment> { return this.http.get<StockAdjustment>(`${this.base}/stock-adjustments/${id}`); }
  createAdjustment(b: { warehouseId: number; note: string | null; lines: AdjustmentInput[] }): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/stock-adjustments`, b);
  }
  approveAdjustment(id: number): Observable<void> { return this.http.post<void>(`${this.base}/stock-adjustments/${id}/approve`, {}); }
  rejectAdjustment(id: number, reason: string): Observable<void> { return this.http.post<void>(`${this.base}/stock-adjustments/${id}/reject`, { reason }); }
  cancelAdjustment(id: number): Observable<void> { return this.http.post<void>(`${this.base}/stock-adjustments/${id}/cancel`, {}); }
}
