import { InventoryDashboard } from './inventory-dashboard.models';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  Batch,
  InventorySummary,
  Movement,
  PurchaseOrder,
  PurchaseOrderInput,
  ReceiveLineInput,
  StaffMember,
  StockCount,
  StockCountDetail,
  StockRow,
  Supplier,
  SupplierInput,
  VariantPick,
  Warehouse,
  WarehouseInput,
  WaitingItem,
} from './models';

// Warehouses, stock, suppliers, purchase orders and stock counts of the dashboard
@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin`;

  private params(values: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '' && v !== false) p = p.set(k, String(v));
    return p;
  }

  // ---------- warehouses and employees
  getWarehouses(): Observable<Warehouse[]> { return this.http.get<Warehouse[]>(`${this.base}/warehouses`); }
  createWarehouse(b: WarehouseInput): Observable<number> { return this.http.post<number>(`${this.base}/warehouses`, b); }
  updateWarehouse(id: number, b: WarehouseInput): Observable<void> { return this.http.put<void>(`${this.base}/warehouses/${id}`, b); }
  deleteWarehouse(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/warehouses/${id}`); }

  getStaff(): Observable<StaffMember[]> { return this.http.get<StaffMember[]>(`${this.base}/warehouse-staff`); }
  createStaff(b: { userName: string; email?: string; fullName: string; password: string; warehouseIds: number[]; role: string; managerWarehouseIds?: number[] }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/warehouse-staff`, b);
  }
  updateStaff(id: string, b: { fullName: string; isActive: boolean; warehouseIds: number[]; role: string; managerWarehouseIds?: number[] }): Observable<void> {
    return this.http.put<void>(`${this.base}/warehouse-staff/${id}`, b);
  }

  resetStaffPassword(id: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.base}/warehouse-staff/${id}/reset-password`, { password });
  }

  // ---------- stock
  getDashboard(days: number, warehouseId: number | null): Observable<InventoryDashboard> {
    return this.http.get<InventoryDashboard>(`${this.base}/inventory/dashboard`, { params: { days, ...(warehouseId ? { warehouseId } : {}) } });
  }
  getSummary(): Observable<InventorySummary> { return this.http.get<InventorySummary>(`${this.base}/inventory/summary`); }
  getStock(warehouseId: number | null, lowOnly = false): Observable<StockRow[]> {
    return this.http.get<StockRow[]>(`${this.base}/inventory/stock`, { params: this.params({ warehouseId, lowOnly }) });
  }
  // includeBundles: only for offers and discounts (a package has no stock: stock screens never list it)
  searchVariants(q: string, includeBundles = false): Observable<VariantPick[]> {
    return this.http.get<VariantPick[]>(`${this.base}/inventory/variants`, { params: this.params({ q, includeBundles }) });
  }
  getMovements(f: { warehouseId?: number | null; variantId?: number | null; type?: string | null; from?: string | null; to?: string | null }): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${this.base}/inventory/movements`, { params: this.params(f) });
  }
  getBatches(f: { warehouseId?: number | null; variantId?: number | null; expiringInDays?: number | null }): Observable<Batch[]> {
    return this.http.get<Batch[]>(`${this.base}/inventory/batches`, { params: this.params(f) });
  }
  getWaiting(): Observable<WaitingItem[]> { return this.http.get<WaitingItem[]>(`${this.base}/inventory/waiting`); }

  receive(b: { warehouseId: number; variantId: number; quantity: number; unitCost: number; batchNumber: string | null; expiryDate: string | null; supplierId: number | null; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/inventory/receive`, b);
  }
  adjust(b: { warehouseId: number; variantId: number; delta: number; reason: string; note: string }): Observable<void> {
    return this.http.post<void>(`${this.base}/inventory/adjust`, b);
  }
  transfer(b: { fromWarehouseId: number; toWarehouseId: number; variantId: number; quantity: number; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/inventory/transfer`, b);
  }
  setReorderLevel(b: { warehouseId: number; variantId: number; level: number }): Observable<void> {
    return this.http.put<void>(`${this.base}/inventory/reorder-level`, b);
  }

  // ---------- stock counts
  getCounts(): Observable<StockCount[]> { return this.http.get<StockCount[]>(`${this.base}/inventory/counts`); }
  getCount(id: number): Observable<StockCountDetail> { return this.http.get<StockCountDetail>(`${this.base}/inventory/counts/${id}`); }
  startCount(b: { warehouseId: number; note: string | null }): Observable<number> { return this.http.post<number>(`${this.base}/inventory/counts`, b); }
  saveCountLines(id: number, lines: { variantId: number; countedQuantity: number | null }[]): Observable<void> {
    return this.http.put<void>(`${this.base}/inventory/counts/${id}/lines`, { lines });
  }
  completeCount(id: number): Observable<void> { return this.http.post<void>(`${this.base}/inventory/counts/${id}/complete`, {}); }
  cancelCount(id: number): Observable<void> { return this.http.post<void>(`${this.base}/inventory/counts/${id}/cancel`, {}); }

  // ---------- suppliers
  getSuppliers(): Observable<Supplier[]> { return this.http.get<Supplier[]>(`${this.base}/suppliers`); }
  createSupplier(b: SupplierInput): Observable<number> { return this.http.post<number>(`${this.base}/suppliers`, b); }
  updateSupplier(id: number, b: SupplierInput): Observable<void> { return this.http.put<void>(`${this.base}/suppliers/${id}`, b); }
  deleteSupplier(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/suppliers/${id}`); }

  // ---------- purchase orders
  getPurchaseOrders(): Observable<PurchaseOrder[]> { return this.http.get<PurchaseOrder[]>(`${this.base}/purchase-orders`); }
  getPurchaseOrder(id: number): Observable<PurchaseOrder> { return this.http.get<PurchaseOrder>(`${this.base}/purchase-orders/${id}`); }
  createPurchaseOrder(b: PurchaseOrderInput): Observable<number> { return this.http.post<number>(`${this.base}/purchase-orders`, b); }
  updatePurchaseOrder(id: number, b: PurchaseOrderInput): Observable<void> { return this.http.put<void>(`${this.base}/purchase-orders/${id}`, b); }
  changePurchaseOrderStatus(id: number, action: 'order' | 'cancel'): Observable<void> {
    return this.http.post<void>(`${this.base}/purchase-orders/${id}/status`, { action });
  }
  receivePurchaseOrder(id: number, lines: ReceiveLineInput[]): Observable<void> {
    return this.http.post<void>(`${this.base}/purchase-orders/${id}/receive`, { lines });
  }
}
