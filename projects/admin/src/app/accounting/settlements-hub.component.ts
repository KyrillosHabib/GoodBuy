import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AuthService } from '@shared/core/auth.service';
import { TranslatePipe } from '@shared/core/pipes';
import { SettlementsAdminComponent } from './settlements-admin.component';
import { TreasuryAdminComponent } from './treasury-admin.component';
import './settlements-hub.i18n';

import { IntroComponent } from '../intro.component';
type HubTab = 'parties' | 'carriers' | 'gateways';

// One door for every settlement: the final clearance of a customer or supplier, the money held by the shipping companies and by the payment gateways
@Component({
  host: { class: 'acc-center' },
  standalone: true,
  imports: [IntroComponent, DecimalPipe, TranslatePipe, SettlementsAdminComponent, TreasuryAdminComponent],
  templateUrl: './settlements-hub.component.html',
})
export class SettlementsHubComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs = computed<HubTab[]>(() => {
    const list: HubTab[] = [];

    if (this.auth.can('accounting', 'accounting.settlements', 'accounting.settlements.approve')) list.push('parties');
    if (this.auth.can('accounting', 'accounting.treasury', 'accounting.approve')) list.push('carriers', 'gateways');

    return list;
  });

  readonly tab = signal<HubTab>('parties');
  readonly waitingAmount = signal(0);
  readonly waitingCount = signal(0);
  readonly approvalCount = signal(0);

  ngOnInit(): void {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as HubTab | null;
    const first = this.tabs()[0];

    if (wanted && this.tabs().includes(wanted)) this.tab.set(wanted);
    else if (first) this.tab.set(first);

    this.loadSummary();
  }

  pick(t: HubTab): void {
    this.tab.set(t);
    this.loadSummary();
  }

  // The small header of every tab: what is waiting to be settled and what is waiting for an approval
  private loadSummary(): void {
    this.waitingAmount.set(0);
    this.waitingCount.set(0);
    this.approvalCount.set(0);

    switch (this.tab()) {
      case 'parties':
        this.api.getSettlements({ status: 'PendingApproval' }).subscribe((r) => this.approvalCount.set(r.length));
        break;
      case 'carriers':
        this.api.getCarrierCollections().subscribe((r) => { this.waitingCount.set(r.length); this.waitingAmount.set(r.reduce((a, c) => a + c.amount, 0)); });
        this.api.getCarrierSettlements('PendingApproval').subscribe((r) => this.approvalCount.set(r.length));
        break;
      case 'gateways':
        this.api.getGatewayCollections().subscribe((r) => { this.waitingCount.set(r.length); this.waitingAmount.set(r.reduce((a, c) => a + c.amount, 0)); });
        this.api.getGatewaySettlements('PendingApproval').subscribe((r) => this.approvalCount.set(r.length));
        break;
    }
  }
}
