import { CoreController, CoreState } from '../gameplay/CoreController';

/**
 * Phase4CoreUI - Lightweight, responsive feedback overlay for Phase 4:
 * - Shows "HOLD E TO EXTRACT" when in proximity
 * - Shows "EXTRACTING..." with ASCII bar "████░░░░░░ 40%" during extraction
 * - Shows "EXTRACTION CANCELLED" if released or walked away
 * - Shows "+1 SHUKA ENERGY CORE" upon successful 100% extraction
 * - Includes quick test controls (Reset button / Status telemetry)
 */
export class Phase4CoreUI {
  private container: HTMLElement;
  private promptRoot: HTMLElement;
  private testPanelRoot: HTMLElement;
  private lastLoggedEvent: string = 'None';
  private onResetCallback: () => void;

  constructor(parent: HTMLElement, onReset: () => void) {
    this.container = parent;
    this.onResetCallback = onReset;

    this.container.innerHTML = '';
    this.container.classList.remove('hidden');

    // 1. Center Prompt / Progress / Notification Layer
    this.promptRoot = document.createElement('div');
    this.promptRoot.id = 'phase4-prompt-root';
    this.promptRoot.className =
      'pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center justify-center z-20 transition-all duration-200';
    this.container.appendChild(this.promptRoot);

    // 2. Top-Left Telemetry & Test Suite Panel
    this.testPanelRoot = document.createElement('div');
    this.testPanelRoot.id = 'phase4-test-panel';
    this.testPanelRoot.className =
      'pointer-events-auto absolute top-4 left-4 z-30 flex flex-col space-y-2 select-none';
    this.container.appendChild(this.testPanelRoot);

    // Listen for DOM CORE_COLLECTED event
    window.addEventListener('CORE_COLLECTED', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.lastLoggedEvent = `CORE_COLLECTED: ${JSON.stringify(detail)}`;
    });
  }

  public update(core: CoreController): void {
    this.renderPrompt(core);
    this.renderTestPanel(core);
  }

  private renderPrompt(core: CoreController): void {
    // 1. When successful (COLLECTED)
    if (core.state === CoreState.COLLECTED) {
      this.promptRoot.innerHTML = `
        <div class="px-8 py-5 bg-slate-950/95 backdrop-blur-xl border border-emerald-400/80 rounded-2xl shadow-[0_0_35px_rgba(52,211,153,0.35)] flex flex-col items-center space-y-1 animate-bounce">
          <div class="text-2xl font-black text-emerald-400 tracking-widest font-mono drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">
            +1 SHUKA ENERGY CORE
          </div>
          <div class="text-xs text-cyan-300 font-mono tracking-[0.2em] uppercase">
            CORE COLLECTED // DATA LINK SECURED
          </div>
        </div>
      `;
      return;
    }

    // 2. When extraction was cancelled
    if (core.showCancelledFeedback) {
      this.promptRoot.innerHTML = `
        <div class="px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border border-rose-500/70 rounded-xl shadow-[0_0_25px_rgba(244,63,94,0.35)] flex items-center space-x-3 text-rose-400 font-mono font-bold tracking-widest text-sm">
          <span class="text-base text-rose-400">✕</span>
          <span>EXTRACTION CANCELLED</span>
        </div>
      `;
      return;
    }

    // 3. When extracting (Holding E)
    if (core.state === CoreState.EXTRACTING) {
      const asciiBar = core.getAsciiProgressBar(10);
      const pct = Math.round(core.extractionProgress * 100);
      const elapsed = (core.extractionProgress * core.extractionDuration).toFixed(1);

      this.promptRoot.innerHTML = `
        <div class="px-8 py-5 bg-slate-950/90 backdrop-blur-lg border border-cyan-400/90 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.4)] flex flex-col items-center space-y-3 min-w-[320px]">
          <div class="text-cyan-400 font-bold text-xs tracking-[0.25em] flex items-center gap-2 font-mono">
            <span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            EXTRACTING...
          </div>
          <div class="font-mono text-cyan-200 text-lg tracking-widest font-bold drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
            ${asciiBar}
          </div>
          <div class="w-full h-2.5 bg-slate-800/90 rounded-full overflow-hidden border border-cyan-900/80 p-0.5">
            <div class="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(6,182,212,0.6)]" style="width: ${pct}%"></div>
          </div>
          <div class="text-[11px] font-mono text-slate-400">
            ${elapsed}s / ${core.extractionDuration.toFixed(1)}s
          </div>
        </div>
      `;
      return;
    }

    // 4. When player enters core range
    if (core.isPlayerInRange && core.state === CoreState.AVAILABLE) {
      this.promptRoot.innerHTML = `
        <div class="px-6 py-3.5 bg-slate-950/85 backdrop-blur-md border border-cyan-500/60 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center space-x-3 text-cyan-300 font-mono tracking-wider animate-pulse">
          <span class="px-2.5 py-1 bg-cyan-500/20 border border-cyan-400/70 rounded text-cyan-200 font-bold text-sm shadow-[0_0_8px_rgba(6,182,212,0.4)]">
            E
          </span>
          <span class="text-sm font-semibold tracking-widest text-slate-100">
            HOLD E TO EXTRACT
          </span>
        </div>
      `;
      return;
    }

    // 5. Player far away -> No extraction UI
    this.promptRoot.innerHTML = '';
  }

  private renderTestPanel(core: CoreController): void {
    const distText = isFinite(core.playerDistance) ? `${core.playerDistance.toFixed(1)}m` : '--';
    const pctText = `${Math.round(core.extractionProgress * 100)}%`;

    let stateBadge = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    if (core.state === CoreState.EXTRACTING) {
      stateBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse';
    } else if (core.state === CoreState.COLLECTED) {
      stateBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
    }

    this.testPanelRoot.innerHTML = `
      <div class="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-300 w-80 shadow-2xl space-y-2">
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="font-bold text-slate-100 tracking-wider flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            EARTH // SHUKA
          </div>
          <span class="text-[10px] text-slate-400 font-semibold uppercase">Phase 4 Test</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div>
            <div class="text-slate-500 text-[10px]">TARGET</div>
            <div class="text-slate-200 font-semibold">${core.coreId}</div>
          </div>
          <div>
            <div class="text-slate-500 text-[10px]">STATE</div>
            <span class="inline-block px-2 py-0.5 border rounded text-[10px] font-bold ${stateBadge}">
              ${core.state}
            </span>
          </div>
          <div>
            <div class="text-slate-500 text-[10px]">DISTANCE</div>
            <div class="text-slate-200 font-semibold">${distText} <span class="text-slate-500 text-[10px]">(Range: 5.0m)</span></div>
          </div>
          <div>
            <div class="text-slate-500 text-[10px]">PROGRESS</div>
            <div class="text-cyan-300 font-semibold">${pctText}</div>
          </div>
        </div>

        <div class="border-t border-slate-800/80 pt-2 flex items-center justify-between">
          <button id="phase4-reset-btn" class="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 rounded text-cyan-300 hover:text-cyan-100 transition-colors font-bold text-[11px] flex items-center gap-1.5 active:scale-95 cursor-pointer">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            RESET CORE [R]
          </button>
          <span class="text-[10px] text-slate-400">[WASD] Move | [E] Hold</span>
        </div>

        ${
          this.lastLoggedEvent !== 'None'
            ? `
          <div class="border-t border-slate-800/80 pt-1.5 text-[10px] text-emerald-400/90 truncate font-mono">
            <span class="text-slate-500">EVENT:</span> ${this.lastLoggedEvent}
          </div>
        `
            : ''
        }
      </div>
    `;

    const resetBtn = this.testPanelRoot.querySelector('#phase4-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.onResetCallback();
      });
    }
  }
}
