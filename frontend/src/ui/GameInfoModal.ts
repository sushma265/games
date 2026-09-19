export class GameInfoModal {
  private container: HTMLElement;
  private onCloseCallback: () => void;

  constructor(container: HTMLElement, onClose: () => void) {
    this.container = container;
    this.onCloseCallback = onClose;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 text-slate-100 overflow-y-auto">
        <div class="max-w-lg w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          
          <!-- Header -->
          <div class="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <div class="text-[10px] font-mono font-bold text-sky-400 tracking-[0.2em] uppercase">HACKATHON OVERVIEW</div>
              <h2 class="text-2xl font-black font-display text-white tracking-wider">EARTH // SHUKA</h2>
            </div>
            <button id="btn-close-game-info" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer transition-colors">
              ✕
            </button>
          </div>

          <!-- Factual Summary Grid -->
          <div class="space-y-4 font-mono text-xs">
            <div class="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div>
                <div class="text-[10px] text-slate-500 uppercase">GENRE</div>
                <div class="font-bold text-sky-300">3D Strategy</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500 uppercase">PLAYERS</div>
                <div class="font-bold text-emerald-300">Up to 4</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500 uppercase">WIN GOAL</div>
                <div class="font-bold text-amber-300">First to 5</div>
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CORE IDEA</div>
              <p class="text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                Two sides race across dual 3D environments (Earth & Shuka). Humans extract Shuka Energy Cores while defending Earth Cores from the Alien AI.
              </p>
            </div>

            <!-- Verified Tech Stack -->
            <div class="space-y-2">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VERIFIED TECH STACK</div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2.5 py-1 bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 rounded-md font-bold text-[11px]">Babylon.js (3D WebGL)</span>
                <span class="px-2.5 py-1 bg-sky-950/80 text-sky-300 border border-sky-800/60 rounded-md font-bold text-[11px]">Socket.IO (Netcode)</span>
                <span class="px-2.5 py-1 bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-md font-bold text-[11px]">Node.js & Express</span>
                <span class="px-2.5 py-1 bg-blue-950/80 text-blue-300 border border-blue-800/60 rounded-md font-bold text-[11px]">TypeScript</span>
                <span class="px-2.5 py-1 bg-violet-950/80 text-violet-300 border border-violet-800/60 rounded-md font-bold text-[11px]">Vite & Tailwind CSS</span>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <button 
            id="btn-confirm-game-info" 
            class="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold font-display text-xs tracking-widest uppercase rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            CLOSE OVERVIEW
          </button>
        </div>
      </div>
    `;

    const closeHandler = () => {
      this.destroy();
      this.onCloseCallback();
    };

    this.container.querySelector('#btn-close-game-info')?.addEventListener('click', closeHandler);
    this.container.querySelector('#btn-confirm-game-info')?.addEventListener('click', closeHandler);
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
