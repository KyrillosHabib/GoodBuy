import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast { id: number; type: ToastType; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(text: string): void { this.show('success', text); }
  error(text: string): void { this.show('error', text, 8000); }
  info(text: string): void { this.show('info', text); }
  warning(text: string): void { this.show('warning', text, 7000); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(type: ToastType, text: string, duration = 5000): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, type, text }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
