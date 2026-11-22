import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { GROUPS, REPORTS, ReportDef } from './reports.defs';
import './reports.i18n';

// The page that opens from "Warehouse reports": every report, grouped by what it is for, with a search box
@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './reports-hub.component.html',
  styleUrl: './reports-hub.component.css',
})
export class ReportsHubComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly search = signal('');

  // The reports this user may open, narrowed by the search text (title or description, in the language of the screen)
  readonly groups = computed(() => {
    const text = this.search().trim().toLowerCase();
    this.i18n.lang();

    const visible = (r: ReportDef) =>
      this.auth.can(...r.perms)
      && (!text || `${this.i18n.t('ir.r.' + r.code + '.title')} ${this.i18n.t('ir.r.' + r.code + '.desc')}`.toLowerCase().includes(text));

    return GROUPS
      .map((id) => ({ id, reports: REPORTS.filter((r) => r.group === id && visible(r)) }))
      .filter((g) => g.reports.length > 0);
  });
}
