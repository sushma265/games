/**
 * LoadingScreen - Initializing World & Engine Loading Screen
 * Displays lightweight progress while Babylon.js scene and network socket initialize.
 */
export class LoadingScreen {
  private container: HTMLElement;
  private rootEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private progressLineEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'loading-overlay';
    this.rootEl.className = 'absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-100 text-slate-800 p-6 select-none transition-opacity duration-300';

    this.rootEl.innerHTML = `
      <div class="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
        <!-- Title & Tagline -->
        <div class="space-y-2">
          <div class="text-xs font-mono font-bold text-sky-600 tracking-[0.25em] uppercase">
            TACTICAL SURVIVAL 3D
          </div>
          <h1 class="text-4xl font-black font-display tracking-widest text-slate-900">
            EARTH // SHUKA
          </h1>
          <p class="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Two Worlds. One Race for Survival.
          </p>
        </div>

        <!-- Progress Spinner & Status -->
        <div class="py-4 flex flex-col items-center justify-center space-y-3">
          <div class="w-10 h-10 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
          <div id="loading-status" class="text-sm font-bold font-mono text-slate-800 tracking-wider uppercase">
            INITIALIZING WORLD...
          </div>
          <div id="loading-progress-line" class="text-xs font-mono text-slate-400">
            Loading engine...
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-400 flex justify-between items-center">
          <span>BABYLON.JS // WEBGL</span>
          <span>NODE // SOCKET.IO</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);
    this.statusEl = this.rootEl.querySelector('#loading-status');
    this.progressLineEl = this.rootEl.querySelector('#loading-progress-line');
  }

  public setStatus(statusText: string, progressDetail?: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = statusText;
    }
    if (this.progressLineEl && progressDetail) {
      this.progressLineEl.textContent = progressDetail;
    }
  }

  public hide(onComplete?: () => void): void {
    if (!this.rootEl) {
      if (onComplete) onComplete();
      return;
    }

    this.setStatus('READY.', 'Launching Main Menu...');
    this.rootEl.classList.add('opacity-0');

    setTimeout(() => {
      this.destroy();
      if (onComplete) onComplete();
    }, 300);
  }

  public destroy(): void {
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
      this.rootEl = null;
    }
  }
}
