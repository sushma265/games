/**
 * HowToPlayUI - Lightweight instructions panel (Light UI Theme)
 * Displays objectives, specialist allocation, abilities, and match rules with a Back button.
 */
export class HowToPlayUI {
  private container: HTMLElement;
  private onBackCallback: () => void;

  constructor(container: HTMLElement, onBack: () => void) {
    this.container = container;
    this.onBackCallback = onBack;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <div class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 text-slate-800 my-auto">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <div class="text-xs font-mono font-bold text-sky-600 tracking-[0.2em] uppercase">
                OPERATIONAL DIRECTIVE
              </div>
              <h2 class="text-2xl font-black font-display text-slate-900 tracking-wide">
                HOW TO PLAY
              </h2>
            </div>
            <button id="btn-htp-close" class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold text-lg transition-colors">
              ✕
            </button>
          </div>

          <!-- Content Grid / Sections -->
          <div class="space-y-4 text-xs font-body leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
            
            <!-- Objective -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div class="font-bold font-display text-slate-900 text-sm tracking-wider uppercase flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-sky-600"></span>
                OBJECTIVE
              </div>
              <p class="text-slate-600">
                Humans land on Planet Shuka to collect <strong class="text-sky-700">5 SHUKA ENERGY CORES</strong>.
              </p>
              <p class="text-slate-600">
                Simultaneously, the Alien AI operates on Earth and collects <strong class="text-rose-700">5 EARTH ENERGY CORES</strong>.
              </p>
              <div class="p-2 bg-sky-50 border border-sky-200 rounded-lg text-sky-800 font-semibold text-center">
                The first side to reach 5 cores wins the match.
              </div>
            </div>

            <!-- Specialists -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div class="font-bold font-display text-slate-900 text-sm tracking-wider uppercase flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                SPECIALISTS
              </div>
              <p class="text-slate-600">
                You have exactly <strong class="text-slate-900">5 SPECIALISTS</strong> to allocate before launch:
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                <div class="bg-white border border-slate-200 p-2.5 rounded-lg">
                  <span class="font-bold text-rose-700 block">EARTH DEFENSE</span>
                  <span class="text-slate-500">Slows alien extraction progress on Earth (+5%/specialist).</span>
                </div>
                <div class="bg-white border border-slate-200 p-2.5 rounded-lg">
                  <span class="font-bold text-sky-700 block">SHUKA EXTRACTION</span>
                  <span class="text-slate-500">Accelerates human extraction beam speed (+5%/specialist).</span>
                </div>
              </div>
            </div>

            <!-- Abilities -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div class="font-bold font-display text-slate-900 text-sm tracking-wider uppercase flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-purple-600"></span>
                TACTICAL ABILITIES
              </div>
              <div class="space-y-2 font-mono text-[11px]">
                <div class="bg-white border border-slate-200 p-2.5 rounded-lg">
                  <div class="flex justify-between items-center font-bold text-sky-700 mb-1">
                    <span>EMP SURGE [Key: 1]</span>
                    <span class="text-slate-400">CD: 20s</span>
                  </div>
                  <span class="text-slate-600">Pauses alien extraction on Earth for 5 seconds.</span>
                </div>

                <div class="bg-white border border-slate-200 p-2.5 rounded-lg">
                  <div class="flex justify-between items-center font-bold text-amber-700 mb-1">
                    <span>OVERCHARGE [Key: 2]</span>
                    <span class="text-slate-400">CD: 25s</span>
                  </div>
                  <span class="text-slate-600">Disrupts alien extraction process and sets progress back.</span>
                </div>

                <div class="bg-white border border-slate-200 p-2.5 rounded-lg">
                  <div class="flex justify-between items-center font-bold text-indigo-700 mb-1">
                    <span>SCAN [Key: 3]</span>
                    <span class="text-slate-400">Duration: 5s // CD: 15s</span>
                  </div>
                  <span class="text-slate-600">Highlights waypoint to the nearest uncollected Shuka Core.</span>
                </div>
              </div>
            </div>

            <!-- Match Duration & Time Expiry -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1 text-slate-600 font-mono text-[11px]">
              <div class="font-bold font-display text-slate-900 text-xs uppercase mb-1">MATCH DURATION</div>
              <div>• Target match duration: <strong class="text-slate-900">3–5 minutes</strong> (300 seconds).</div>
              <div>• If time expires: higher core count wins; equal core counts result in a <strong>DRAW</strong>.</div>
            </div>
          </div>

          <!-- Footer Back Button -->
          <div class="pt-2 border-t border-slate-200">
            <button id="btn-htp-back" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors shadow-sm">
              BACK TO MAIN MENU
            </button>
          </div>

        </div>
      </div>
    `;

    this.container.querySelector('#btn-htp-close')?.addEventListener('click', () => this.onBackCallback());
    this.container.querySelector('#btn-htp-back')?.addEventListener('click', () => this.onBackCallback());
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
