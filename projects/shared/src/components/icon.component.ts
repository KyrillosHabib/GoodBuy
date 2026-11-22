import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { iconSvg } from '../core/icons';

// <app-icon name="truck" [size]="24" />  (inherits the text color)
@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  html: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(iconSvg(null, 24));

  private _name: string | null | undefined = null;
  private _size = 24;

  @Input() set name(value: string | null | undefined) {
    this._name = value;
    this.render();
  }

  @Input() set size(value: number) {
    this._size = value;
    this.render();
  }

  private render(): void {
    this.html = this.sanitizer.bypassSecurityTrustHtml(iconSvg(this._name, this._size));
  }
}
