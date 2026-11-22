import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@shared/environments/environment';

export type ColumnType = 'text' | 'int' | 'money' | 'percent' | 'date' | 'datetime' | 'code' | 'movementType' | 'status' | 'barcode';

export interface ReportColumn { key: string; type: ColumnType; }
export interface ReportMetric { key: string; value: string | number | null; type: ColumnType; }
export interface ReportTable { title: string | null; columns: ReportColumn[]; rows: Record<string, string | number | null>[]; totals: Record<string, string | number | null> | null; }
export interface InventoryReport { code: string; generatedAtUtc: string; summary: ReportMetric[]; tables: ReportTable[]; truncated: boolean; }

export interface LookupItem { id: number; name: string; }
export interface ReportLookups { warehouses: LookupItem[]; suppliers: LookupItem[]; categories: LookupItem[]; brands: LookupItem[]; }

@Injectable({ providedIn: 'root' })
export class InventoryReportsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin/inventory-reports`;

  getLookups(): Observable<ReportLookups> {
    return this.http.get<ReportLookups>(`${this.base}/lookups`);
  }

  run(code: string, filters: Record<string, string>): Observable<InventoryReport> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== '' && value !== null && value !== undefined) params = params.set(key, value);
    }

    return this.http.get<InventoryReport>(`${this.base}/${code}`, { params });
  }
}
