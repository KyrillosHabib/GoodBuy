import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import './intros.i18n';
import { ToastService } from '@shared/core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
