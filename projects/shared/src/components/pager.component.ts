import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../core/pipes';

@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './pager.component.html',
})
export class PagerComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) totalPages = 1;
  @Output() pageChange = new EventEmitter<number>();
}
