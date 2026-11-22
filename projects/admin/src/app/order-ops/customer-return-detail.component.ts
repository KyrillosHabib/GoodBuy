import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { CustomerReturn, OrderOpsApi, ReturnDisposition } from './order-ops.api';
import './fulfilment.i18n';

interface Decision { disposition: ReturnDisposition; condition: string; }

// One customer return: the warehouse receives the goods, checks every line, the head of the warehouse approves what is not simply good.
// The stock changes only when a line is applied (good: back on sale; damaged: written off; isolated: nothing until the head decides).
@Component({
  selector: 'app-customer-return-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './customer-return-detail.component.html',
  styleUrl: './customer-return-detail.component.css',
})
export class CustomerReturnDetailComponent implements OnInit {
  private readonly api = inject(OrderOpsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly dispositions: ReturnDisposition[] = ['Restock', 'Damaged', 'Quarantine'];
  readonly r = signal<CustomerReturn | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  // What the checker picked and did not save yet: line id -> decision
  readonly decisions = signal<Record<number, Decision>>({});

  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.api.getReturn(this.id).subscribe({
      next: (ret) => {
        this.r.set(ret);
        this.decisions.set(Object.fromEntries(ret.lines.map((l) => [l.id, { disposition: l.disposition, condition: l.condition ?? '' }])));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  stamp(utc: string): string {
    return utc.slice(0, 16).replace('T', ' ');
  }

  decision(lineId: number): Decision {
    return this.decisions()[lineId] ?? { disposition: 'Pending', condition: '' };
  }

  setDisposition(lineId: number, value: ReturnDisposition): void {
    this.decisions.update((d) => ({ ...d, [lineId]: { ...this.decision(lineId), disposition: value } }));
  }

  setCondition(lineId: number, value: string): void {
    this.decisions.update((d) => ({ ...d, [lineId]: { ...this.decision(lineId), condition: value } }));
  }

  receive(): void {
    this.run(this.api.receiveReturn(this.id), 'cr.ok.received');
  }

  inspect(submit: boolean): void {
    const ret = this.r();

    if (!ret) return;

    if (submit && ret.lines.some((l) => this.decision(l.id).disposition === 'Pending')) {
      this.toast.error(this.i18n.t('cr.decideAll'));
      return;
    }

    const lines = ret.lines.map((l) => ({ lineId: l.id, disposition: this.decision(l.id).disposition, condition: this.decision(l.id).condition.trim() || null }));

    this.run(this.api.inspectReturn(this.id, lines, submit), submit ? 'cr.ok.submitted' : 'cr.ok.saved');
  }

  approve(): void {
    if (!confirm(this.i18n.t('cr.approveConfirm'))) return;

    this.run(this.api.approveReturn(this.id), 'cr.ok.approved');
  }

  reject(): void {
    const reason = prompt(this.i18n.t('cr.rejectAsk'));

    if (!reason || !reason.trim()) return;

    this.run(this.api.rejectReturn(this.id, reason.trim()), 'cr.ok.rejected');
  }

  resolve(lineId: number, disposition: 'Restock' | 'Damaged'): void {
    if (!confirm(this.i18n.t(disposition === 'Restock' ? 'cr.restockConfirm' : 'cr.writeOffConfirm'))) return;

    this.run(this.api.resolveQuarantine(lineId, disposition), 'cr.ok.resolved');
  }

  cancel(): void {
    if (!confirm(this.i18n.t('cr.cancelConfirm'))) return;

    this.run(this.api.cancelReturn(this.id), 'cr.ok.cancelled');
  }

  private run(call: ReturnType<OrderOpsApi['receiveReturn']>, okKey: string): void {
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t(okKey));
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.load();
      },
    });
  }
}
