import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@shared/environments/environment';

export interface StockWarehouse { id: number; name: string; canSetOpening: boolean; }

export interface VariantWarehouseStock {
  warehouseId: number; onHand: number; reorderLevel: number; avgCost: number; value: number; openingQty: number; batches: number;
}

export interface ProductStockVariant {
  id: number; sku: string; label: string; barcode: string | null; trackStock: boolean;
  reserved: number; totalOnHand: number; available: number; totalValue: number; stock: VariantWarehouseStock[];
}

export interface ProductStock { productId: number; productName: string; isBundle: boolean; warehouses: StockWarehouse[]; variants: ProductStockVariant[]; }

export interface OpeningLine {
  warehouseId: number; variantId: number; quantity: number; unitCost: number;
  batchNumber: string | null; expiryDate: string | null; note: string | null;
}

@Injectable({ providedIn: 'root' })
export class InventoryOpsApi {
  private readonly http = inject(HttpClient);
  private readonly products = `${environment.apiUrl}/api/admin/products`;

  getProductStock(productId: number): Observable<ProductStock> {
    return this.http.get<ProductStock>(`${this.products}/${productId}/stock`);
  }

  saveOpeningBalance(productId: number, lines: OpeningLine[]): Observable<{ saved: number }> {
    return this.http.post<{ saved: number }>(`${this.products}/${productId}/opening-balance`, { lines });
  }

  // ---------------------------------------------------------------- goods that go back to a supplier

  private readonly returns = `${environment.apiUrl}/api/admin/supplier-returns`;

  getReturnLookups(): Observable<ReturnLookups> {
    return this.http.get<ReturnLookups>(`${this.returns}/lookups`);
  }

  getReturnBatches(warehouseId: number, variantId: number): Observable<ReturnBatchOption[]> {
    return this.http.get<ReturnBatchOption[]>(`${this.returns}/batches`, { params: { warehouseId, variantId } });
  }

  getSupplierReturns(filters: { view?: string; status?: string; supplierId?: string; search?: string }): Observable<SupplierReturnList> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }

    return this.http.get<SupplierReturnList>(this.returns, { params });
  }

  getSupplierReturn(id: number): Observable<SupplierReturn> {
    return this.http.get<SupplierReturn>(`${this.returns}/${id}`);
  }

  createSupplierReturn(body: SupplierReturnSave): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.returns, body);
  }

  updateSupplierReturn(id: number, body: SupplierReturnSave): Observable<void> {
    return this.http.put<void>(`${this.returns}/${id}`, body);
  }

  submitSupplierReturn(id: number): Observable<void> { return this.http.post<void>(`${this.returns}/${id}/submit`, {}); }

  approveSupplierReturn(id: number): Observable<void> { return this.http.post<void>(`${this.returns}/${id}/approve`, {}); }

  rejectSupplierReturn(id: number, reason: string): Observable<void> { return this.http.post<void>(`${this.returns}/${id}/reject`, { reason }); }

  cancelSupplierReturn(id: number): Observable<void> { return this.http.post<void>(`${this.returns}/${id}/cancel`, {}); }

  executeSupplierReturn(id: number, supplierDocument: string | null): Observable<void> {
    return this.http.post<void>(`${this.returns}/${id}/execute`, { supplierDocument });
  }

  // ---------------------------------------------------------------- transfer requests between warehouses

  private readonly transfers = `${environment.apiUrl}/api/admin/transfers`;

  getTransferWarehouses(): Observable<TransferWarehouse[]> {
    return this.http.get<TransferWarehouse[]>(`${this.transfers}/warehouses`);
  }

  getTransfers(filters: { view?: string; status?: string; search?: string }): Observable<TransferList> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }

    return this.http.get<TransferList>(this.transfers, { params });
  }

  getTransfer(id: number): Observable<Transfer> {
    return this.http.get<Transfer>(`${this.transfers}/${id}`);
  }

  createTransfer(body: TransferSave): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.transfers, body);
  }

  updateTransfer(id: number, body: TransferSave): Observable<void> {
    return this.http.put<void>(`${this.transfers}/${id}`, body);
  }

  submitTransfer(id: number): Observable<void> { return this.http.post<void>(`${this.transfers}/${id}/submit`, {}); }

  cancelTransfer(id: number): Observable<void> { return this.http.post<void>(`${this.transfers}/${id}/cancel`, {}); }

  approveTransfer(id: number, lines: { lineId: number; quantity: number }[]): Observable<void> {
    return this.http.post<void>(`${this.transfers}/${id}/approve`, { lines });
  }

  rejectTransfer(id: number, reason: string): Observable<void> { return this.http.post<void>(`${this.transfers}/${id}/reject`, { reason }); }

  dispatchTransfer(id: number, shippingNote: string | null): Observable<void> {
    return this.http.post<void>(`${this.transfers}/${id}/dispatch`, { shippingNote });
  }

  receiveTransfer(id: number, lines: { lineId: number; quantity: number }[], note: string | null): Observable<void> {
    return this.http.post<void>(`${this.transfers}/${id}/receive`, { lines, note });
  }
}

export type TransferStatus = 'Draft' | 'Requested' | 'Approved' | 'Rejected' | 'InTransit' | 'Received' | 'Cancelled';

export interface TransferWarehouse { id: number; name: string; isMine: boolean; }

export interface TransferListItem {
  id: number; number: string; fromWarehouseId: number; fromWarehouse: string; toWarehouseId: number; toWarehouse: string;
  status: TransferStatus; lines: number; units: number; createdAtUtc: string; createdBy: string | null;
}

export interface TransferList { items: TransferListItem[]; counts: { toApprove: number; toDispatch: number; toReceive: number }; }

export interface TransferLine {
  id: number; variantId: number; sku: string; item: string; label: string; barcode: string | null;
  requested: number; approved: number; dispatched: number; received: number; note: string | null;
  availableAtSource: number; onHandAtDestination: number; reorderAtDestination: number;
}

export interface TransferCan { edit: boolean; submit: boolean; cancel: boolean; approve: boolean; reject: boolean; dispatch: boolean; receive: boolean; }

export interface Transfer {
  id: number; number: string; fromWarehouseId: number; fromWarehouse: string; toWarehouseId: number; toWarehouse: string; status: TransferStatus;
  note: string | null; isDirect: boolean; createdAtUtc: string; createdBy: string | null; requestedAtUtc: string | null;
  approvedBy: string | null; approvedAtUtc: string | null; rejectionReason: string | null;
  dispatchedBy: string | null; dispatchedAtUtc: string | null; shippingNote: string | null;
  receivedBy: string | null; receivedAtUtc: string | null; receiveNote: string | null;
  cancelledBy: string | null; cancelledAtUtc: string | null; shortageValue: number;
  lines: TransferLine[]; can: TransferCan;
}

export interface TransferSave {
  fromWarehouseId: number; toWarehouseId: number; note: string | null; send: boolean; direct: boolean;
  lines: { variantId: number; quantity: number; note: string | null }[];
}

export type ReturnStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled';
export type ReturnReason = 'Damaged' | 'Expired' | 'WrongItem' | 'Excess' | 'Quality' | 'Other';

export interface ReturnLookups { warehouses: { id: number; name: string }[]; suppliers: { id: number; name: string }[]; }

export interface ReturnBatchOption {
  id: number; batchNumber: string; expiryDate: string | null; unitCost: number; quantityRemaining: number; supplierId: number | null; supplier: string | null;
}

export interface SupplierReturnListItem {
  id: number; number: string; warehouse: string; supplier: string; status: ReturnStatus; lines: number; units: number; totalCost: number;
  createdAtUtc: string; createdBy: string | null;
}

export interface SupplierReturnList { items: SupplierReturnListItem[]; counts: { toApprove: number; toReturn: number }; }

export interface SupplierReturnLine {
  id: number; variantId: number; sku: string; item: string; label: string; barcode: string | null; quantity: number; reason: ReturnReason;
  batchId: number | null; batchNumber: string | null; note: string | null; onHand: number;
  taken: { batchNumber: string; expiryDate: string | null; unitCost: number; quantity: number }[];
}

export interface SupplierReturn {
  id: number; number: string; warehouseId: number; warehouse: string; supplierId: number; supplier: string; status: ReturnStatus; note: string | null;
  createdAtUtc: string; createdBy: string | null; submittedAtUtc: string | null; approvedBy: string | null; approvedAtUtc: string | null; rejectionReason: string | null;
  returnedBy: string | null; returnedAtUtc: string | null; supplierDocument: string | null; cancelledBy: string | null; cancelledAtUtc: string | null; totalCost: number;
  lines: SupplierReturnLine[];
  can: { edit: boolean; submit: boolean; approve: boolean; reject: boolean; execute: boolean; cancel: boolean };
}

export interface SupplierReturnSave {
  warehouseId: number; supplierId: number; note: string | null; submit: boolean;
  lines: { variantId: number; quantity: number; reason: ReturnReason; batchId: number | null; note: string | null }[];
}
