/**
 * NotificationToast - Reusable Toast & Error Notification Manager
 * Renders user-friendly error banners and notification toasts without raw exceptions or stack traces.
 */
export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface ToastOptions {
  message: string;
  type?: NotificationType;
  durationMs?: number;
}

export class NotificationToast {
  private static containerEl: HTMLElement | null = null;

  private static getContainer(): HTMLElement {
    if (!this.containerEl) {
      this.containerEl = document.getElementById('toast-container');
      if (!this.containerEl) {
        this.containerEl = document.createElement('div');
        this.containerEl.id = 'toast-container';
        this.containerEl.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4';
        document.body.appendChild(this.containerEl);
      }
    }
    return this.containerEl;
  }

  public static show(options: ToastOptions | string): void {
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const type = opts.type || 'error';
    const duration = opts.durationMs || 4000;

    const container = this.getContainer();

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-mono font-medium shadow-md transition-all duration-200 transform translate-y-2 opacity-0 ${
      type === 'error'
        ? 'bg-rose-50 border-rose-200 text-rose-800'
        : type === 'warning'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-cyan-50 border-cyan-200 text-cyan-800'
    }`;

    const icon = type === 'error' ? '⚠' : type === 'warning' ? '⚡' : type === 'success' ? '✓' : 'ℹ';

    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm">${icon}</span>
        <span>${this.escapeHtml(opts.message)}</span>
      </div>
      <button class="toast-close hover:opacity-75 font-bold text-sm ml-2">✕</button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    const close = () => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-2', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', close);

    if (duration > 0) {
      setTimeout(close, duration);
    }
  }

  private static escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
