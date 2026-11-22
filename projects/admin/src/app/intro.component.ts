import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// The explanation under the title of a screen: the sentence that says what the screen is for, then its steps (1, 2, 3)
// side by side, as wide as the page, so it takes little height. It can be hidden from the top bar (class "page-intro").
@Component({
  selector: 'app-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-intro' },
  templateUrl: './intro.component.html',
})
export class IntroComponent {
  lead = '';
  steps: string[] = [];
  notes: string[] = [];

  @Input() set text(value: string | null | undefined) {
    const lead: string[] = [], steps: string[] = [], notes: string[] = [];

    for (const raw of (value ?? '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      const m = /^(?:\d+|[٠-٩]+)\s*[).\-–]\s*(.+)$/.exec(line);
      if (m) steps.push(m[1]);
      else if (steps.length) notes.push(line);
      else lead.push(line);
    }

    this.lead = lead.join(' ');
    this.steps = steps;
    this.notes = notes;
  }
}
