import { Component, Input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PICKER_ICONS } from '../core/icons';
import { TranslatePipe } from '../core/pipes';
import { IconComponent } from './icon.component';

// Grid of ready-made icons: the admin clicks one instead of typing its name.
@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  templateUrl: './icon-picker.component.html',
})
export class IconPickerComponent {
  @Input({ required: true }) control!: FormControl<any>;
  @Input() label = 'a.content.icon';

  readonly query = signal('');

  filtered(): typeof PICKER_ICONS {
    const q = this.query().trim().toLowerCase();

    return q ? PICKER_ICONS.filter((i) => (i.name + ' ' + i.keywords).toLowerCase().includes(q)) : PICKER_ICONS;
  }

  pick(name: string): void {
    this.control.setValue(name);
    this.control.markAsDirty();
  }
}
