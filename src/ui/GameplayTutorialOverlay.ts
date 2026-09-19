/**
 * GameplayTutorialOverlay
 * Displays a concise tactical overview on first gameplay session.
 * Respects 'SHOW TUTORIAL' setting in SettingsUI.
 */
export class GameplayTutorialOverlay {
  private container: HTMLElement;
  private rootEl: HTMLElement | null = null;
  private onDismissCb: () => void;

  constructor(container: HTMLElement, onDismiss: () => void) {
    this.container = container;
    this.onDismissCb = onDismiss;
    this.render();
  }

  public static shouldShow(): boolean {
    try {
      const pref = localStorage.getItem('earth_shuka_show_tutorial');
      return pref !== 'false';
    } catch {
      return true;
    }
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'gameplay-tutorial-overlay';
    this.rootEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md text-slate-800 transition-opacity duration-200';

    this.rootEl.innerHTML = `
      <div class="bg-white border-2 border-sky-500 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
        <!-- Header -->
        <div class="space-y-1">
          <div class="text-[11px] font-mono font-bold text-sky-600 tracking-[0.25em] uppercase">
            TACTICAL BRIEFING
          </div>
          <h2 class="text-2xl font-black font-display tracking-widest text-slate-900 uppercase">
            MISSION PROTOCOL
          </h2>
          <p class="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Collect 5 Shuka Cores before the Alien extracts 5 Earth Cores.
          </p>
        </div>

        <!-- Gameplay Controls & Instructions Grid -->
        <div class="space-y-3 text-left font-mono text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-3">
            <span class="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <span class="font-bold text-slate-900 block">SHUKA ENERGY CORES</span>
              <span class="text-slate-600 text-[11px]">Approach glowing cyan cores. Hold <strong class="text-sky-700">[F] / [SPACE]</strong> (or touch button) to extract.</span>
            </div>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-3">
            <span class="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <span class="font-bold text-slate-900 block">TACTICAL DISRUPTION</span>
              <span class="text-slate-600 text-[11px]">Use <strong class="text-sky-700">EMP Surge [E]</strong> (pause 5s), <strong class="text-amber-700">Overcharge [Q]</strong> (setback), & <strong class="text-cyan-700">Scan [R]</strong> (locate) to thwart the Alien AI.</span>
            </div>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-3">
            <span class="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">3</span>
            <div>
              <span class="font-bold text-slate-900 block">RECON & CREW</span>
              <span class="text-slate-600 text-[11px]">Press <strong class="text-indigo-700">[V]</strong> to toggle Recon Camera. Specialist crew allocation powers your team's extraction speed.</span>
            </div>
          </div>
        </div>

        <!-- Confirm Dismiss Button -->
        <button id="btn-tutorial-got-it" class="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold font-display text-sm tracking-wider uppercase rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer">
          GOT IT — START MISSION
        </button>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.rootEl.querySelector('#btn-tutorial-got-it')?.addEventListener('click', () => {
      this.destroy();
      this.onDismissCb();
    });
  }

  public destroy(): void {
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
      this.rootEl = null;
    }
  }
}
