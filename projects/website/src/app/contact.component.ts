import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { buildMapEmbed } from '@shared/core/maps';
import { TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { SiteService } from '@shared/core/site.service';
import { emptyToNull } from '@shared/core/translation-forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, IconComponent],
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  readonly site = inject(SiteService);

  private readonly sanitizer = inject(DomSanitizer);

  readonly sending = signal(false);
  readonly sent = signal(false);

  readonly whatsappLink = computed(() => {
    const digits = (this.site.home()?.company.whatsAppNumber ?? '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

  // Only Google Maps embeds are accepted
  readonly mapUrl = computed<SafeResourceUrl | null>(() => {
    const url = buildMapEmbed(this.site.home()?.company.mapEmbedUrl);

    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  // Coming from a product page: ?product=3&productName=Air%20Fryer
  readonly productId = Number(this.route.snapshot.queryParamMap.get('product')) || null;
  readonly productName = this.route.snapshot.queryParamMap.get('productName');

  readonly form = this.fb.group({
    name: ['', Validators.required],
    company: [''],
    country: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    message: ['', Validators.required],
  });

  invalid(control: 'name' | 'email' | 'message'): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    this.sending.set(true);
    this.api
      .submitInquiry({
        name: v.name ?? '',
        company: emptyToNull(v.company),
        country: emptyToNull(v.country),
        email: v.email ?? '',
        phone: emptyToNull(v.phone),
        productId: this.productId,
        message: v.message ?? '',
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
          this.form.reset();
        },
        error: () => this.sending.set(false),
      });
  }
}
