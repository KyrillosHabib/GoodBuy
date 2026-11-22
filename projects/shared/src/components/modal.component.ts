import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';

// Pop-up dialog used for every add / edit form of the dashboard.
// Render it only while it is needed:  @if (formOpen()) { <app-modal ...>...</app-modal> }
// Footer buttons go in an element with the `modal-footer` attribute.
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() size: 'md' | 'lg' | 'xl' = 'md';
  @Output() closed = new EventEmitter<void>();

  ngOnInit(): void {
    document.body.classList.add('modal-open');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) this.closed.emit();
  }
}
