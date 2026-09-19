export class OnboardingOverlay {
  private container: HTMLElement;
  private onStartCallback: () => void;
  private isMobile: boolean = false;

  constructor(container: HTMLElement, onStart: () => void) {
    this.container = container;
    this.onStartCallback = onStart;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    this.render();
  }

  public static hasSeenTutorial(): boolean {
    try {
      return localStorage.getItem('earthShukaTutorialSeen') === 'true';
    } catch {
      return false;
    }
  }

  public static setTutorialSeen(seen: boolean): void {
    try {
      localStorage.setItem('earthShukaTutorialSeen', seen ? 'true' : 'false');
    } catch {
      // safe fallback
    }
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 text-slate-100 overflow-y-auto">
        <div class="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fadeIn">
          
          <!-- Header -->
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold text-sky-400 tracking-[0.3em] uppercase">
              JUDGE DEMO & ONBOARDING
            </div>
            <h2 class="text-3xl font-black font-display tracking-widest text-white">
              EARTH // SHUKA
            </h2>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Two Worlds. One Race for Survival.
            </p>
          </div>

          <!-- 30-Second Mission Briefing -->
          <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-left space-y-3 font-mono text-xs">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-sky-400 font-bold">HUMAN OBJECTIVE</span>
              <span class="text-slate-300">COLLECT 5 SHUKA CORES</span>
            </div>
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-rose-400 font-bold">ALIEN OBJECTIVE</span>
              <span class="text-slate-300">COLLECT 5 EARTH CORES</span>
            </div>
            <div class="text-center text-amber-400 font-bold tracking-wider pt-1">
              FIRST TO 5 WINS THE MATCH!
            </div>
          </div>

          <!-- Controls Guide -->
          <div class="space-y-2 text-left">
            <div class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              ${this.isMobile ? 'TOUCH CONTROLS' : 'TACTICAL CONTROLS'}
            </div>
            
            ${
              this.isMobile
                ? `
              <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700"><span class="text-sky-400 font-bold">MOVE:</span> TOUCH JOYSTICK</div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700"><span class="text-sky-400 font-bold">LOOK:</span> DRAG SCREEN</div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700"><span class="text-amber-400 font-bold">EMP:</span> EMP BUTTON</div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700"><span class="text-cyan-400 font-bold">SCAN:</span> SCAN BUTTON</div>
              </div>
            `
                : `
              <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                  <span class="text-slate-400">MOVE</span>
                  <span class="text-sky-300 font-bold">WASD</span>
                </div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                  <span class="text-slate-400">EMP SURGE</span>
                  <span class="text-sky-300 font-bold">[1] or [E]</span>
                </div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                  <span class="text-slate-400">OVERCHARGE</span>
                  <span class="text-amber-300 font-bold">[2] or [Q]</span>
                </div>
                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex justify-between">
                  <span class="text-slate-400">SCAN CORES</span>
                  <span class="text-cyan-300 font-bold">[3] or [R]</span>
                </div>
              </div>
            `
            }
          </div>

          <!-- Start Button -->
          <button 
            id="btn-onboarding-start" 
            class="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black font-display text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            START DEMO MATCH
          </button>
        </div>
      </div>
    `;

    const btn = this.container.querySelector('#btn-onboarding-start');
    btn?.addEventListener('click', () => {
      OnboardingOverlay.setTutorialSeen(true);
      this.destroy();
      this.onStartCallback();
    });
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
