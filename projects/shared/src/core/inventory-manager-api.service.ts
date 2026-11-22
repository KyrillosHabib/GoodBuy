import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { InventoryManagerDashboard } from './inventory-manager.models';

@Injectable({ providedIn: 'root' })
export class InventoryManagerApiService {
  private readonly http = inject(HttpClient);

  get(days: number, warehouseId: number | null): Observable<InventoryManagerDashboard> {
    let params = new HttpParams().set('days', String(days));

    if (warehouseId) params = params.set('warehouseId', String(warehouseId));

    return this.http.get<InventoryManagerDashboard>(`${environment.apiUrl}/api/admin/inventory/dashboard/manager`, { params });
  }
}
