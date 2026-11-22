import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { JournalDetailReport, JournalSummaryReport, TreasuryMovementReport } from './journal-reports.models';

// The journal reports and the treasury movement report (kept apart from the main accounting service)
@Injectable({ providedIn: 'root' })
export class JournalReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin/accounting/reports`;

  private params(values: Record<string, string | number | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  getJournalDetail(from: string, to: string, source?: string | null, accountType?: string | null): Observable<JournalDetailReport> {
    return this.http.get<JournalDetailReport>(`${this.base}/journal-detail`, { params: this.params({ from, to, source, accountType }) });
  }

  getJournalSummary(from: string, to: string, source?: string | null, accountType?: string | null): Observable<JournalSummaryReport> {
    return this.http.get<JournalSummaryReport>(`${this.base}/journal-summary`, { params: this.params({ from, to, source, accountType }) });
  }

  getTreasuryMovement(from: string, to: string, cashAccountId?: number | null): Observable<TreasuryMovementReport> {
    return this.http.get<TreasuryMovementReport>(`${this.base}/treasury-movement`, { params: this.params({ from, to, cashAccountId }) });
  }
}
