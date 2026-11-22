import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashComponent } from './splash.component';
import { ToastService } from '@shared/core/toast.service';

import './pages.i18n';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SplashComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
