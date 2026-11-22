import { Component, Input, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { AssetUrlPipe, TranslatePipe } from '../core/pipes';

// A URL input + upload button (POST /api/admin/media/images) + preview.
@Component({
  selector: 'app-image-field',
  standalone: true,
  imports: [ReactiveFormsModule, AssetUrlPipe, TranslatePipe],
  templateUrl: './image-field.component.html',
})
export class ImageFieldComponent {
  private readonly api = inject(AdminApiService);

  @Input({ required: true }) control!: FormControl<any>;
  // Translation key of the label
  @Input() label = 'a.image';

  readonly uploading = signal(false);

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.uploading.set(true);
    this.api.uploadImage(file).subscribe({
      next: (result) => {
        this.control.setValue(result.url);
        this.control.markAsDirty();
        this.uploading.set(false);
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      },
    });
  }
}
