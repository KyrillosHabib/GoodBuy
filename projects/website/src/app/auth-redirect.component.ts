import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthDrawerService } from './auth-drawer.service';

// /login and /register (links, guards, e-mails) now open the side drawer over the home page
@Component({ selector: 'app-auth-redirect', standalone: true, template: '' })
export class AuthRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly drawer = inject(AuthDrawerService);

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const tab = this.route.snapshot.data['tab'] === 'register' ? 'register' : 'login';

    this.drawer.open(tab, q.get('returnUrl'), q.get('email') ?? '');
    void this.router.navigate(['/'], { replaceUrl: true });
  }
}
