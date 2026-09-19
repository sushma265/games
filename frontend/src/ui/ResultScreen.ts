import confetti from 'canvas-confetti';
import { AudioManager } from '../core/AudioManager';

export interface ResultStats {
  winner: 'HUMAN' | 'ALIEN' | 'DRAW';
  isWin?: boolean;
  shukaCoresCollected: number;
  earthCoresLost: number;
  missionDurationSeconds: number;
  abilitiesUsed?: number;
  reason?: string;
}

export class ResultScreen {
  private modalRoot: HTMLElement;
  private audioMgr: AudioManager;
  private onRematchCallback: () => void;
  private onReturnToMenuCallback: () => void;

  constructor(
    modalRoot: HTMLElement,
    audioMgr: AudioManager,
    onRematch: () => void,
    onReturnToMenu: () => void
  ) {
    this.modalRoot = modalRoot;
    this.audioMgr = audioMgr;
    this.onRematchCallback = onRematch;
    this.onReturnToMenuCallback = onReturnToMenu;
  }

  public show(stats: ResultStats): void {
    this.modalRoot.classList.remove('hidden');

    const mins = Math.floor(stats.missionDurationSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(stats.missionDurationSeconds % 60).toString().padStart(2, '0');
    const formattedDuration = `${mins}:${secs}`;

    const isHumanWin = stats.winner === 'HUMAN' || stats.isWin === true;
    const isDraw = stats.winner === 'DRAW';

    let winnerTitle = 'HUMAN VICTORY';
    let winnerSubtitle = 'HUMANITY SECURED PLANET SHUKA';
    let winnerDesc = 'Humanity survives. The alien invasion forces on Earth have collapsed as their power grid was starved.';
    let bannerColorClass = 'text-sky-600';
    let borderColorClass = 'border-sky-500';
    let badgeBgClass = 'bg-sky-50 text-sky-800 border-sky-200';

    if (isDraw) {
      winnerTitle = 'MATCH DRAW';
      winnerSubtitle = 'TIME EXPIRED — EQUAL SCORE';
      winnerDesc = 'Match time has expired with equal core collection. Neither side achieved total orbital control.';
      bannerColorClass = 'text-amber-600';
      borderColorClass = 'border-amber-500';
      badgeBgClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (!isHumanWin) {
      winnerTitle = 'ALIEN VICTORY';
      winnerSubtitle = 'EARTH CORES DRAINED';
      winnerDesc = 'The alien extraction is complete. Earth energy reserves have been drained.';
      bannerColorClass = 'text-rose-600';
      borderColorClass = 'border-rose-500';
      badgeBgClass = 'bg-rose-50 text-rose-800 border-rose-200';
    }

    if (isHumanWin) {
      this.audioMgr.playWin();
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {
        // safe fallback
      }
    } else {
      this.audioMgr.playLose();
    }

    this.modalRoot.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <div class="bg-white border-2 ${borderColorClass} rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-800 text-center my-auto">
          
          <!-- Outcome Header -->
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold tracking-[0.25em] uppercase ${bannerColorClass}">
              MATCH RESULTS
            </div>
            <h1 class="text-3xl sm:text-4xl font-black font-display tracking-widest text-slate-900">
              ${winnerTitle}
            </h1>
            <p class="text-xs font-bold font-display tracking-widest uppercase ${bannerColorClass}">
              ${winnerSubtitle}
            </p>
          </div>

          <p class="text-xs text-slate-600 font-body leading-relaxed max-w-md mx-auto">
            ${winnerDesc}
          </p>

          <!-- Reason Badge if provided -->
          ${stats.reason ? `
            <div class="inline-block px-3 py-1 rounded-full border text-xs font-mono font-semibold ${badgeBgClass}">
              REASON: ${this.escapeHtml(stats.reason.replace(/_/g, ' '))}
            </div>
          ` : ''}

          <!-- Stats Grid -->
          <div class="grid grid-cols-2 gap-3 w-full bg-slate-50 p-4 border border-slate-200 rounded-xl text-left font-mono text-xs">
            <div>
              <span class="text-slate-500 block text-[10px] uppercase">HUMAN SHUKA CORES</span>
              <div class="text-sky-700 font-bold text-base">${stats.shukaCoresCollected} / 5</div>
            </div>

            <div>
              <span class="text-slate-500 block text-[10px] uppercase">ALIEN EARTH CORES</span>
              <div class="text-rose-700 font-bold text-base">${stats.earthCoresLost} / 5</div>
            </div>

            <div>
              <span class="text-slate-500 block text-[10px] uppercase">MATCH DURATION</span>
              <div class="text-slate-900 font-bold text-base">${formattedDuration}</div>
            </div>

            <div>
              <span class="text-slate-500 block text-[10px] uppercase">TACTICAL ABILITIES</span>
              <div class="text-amber-700 font-bold text-base">${stats.abilitiesUsed || 0} DEPLOYED</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button id="btn-result-rematch" class="flex-1 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold font-display text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer">
              RETURN TO LOBBY (REMATCH)
            </button>
            <button id="btn-result-menu" class="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors cursor-pointer">
              MAIN MENU
            </button>
          </div>

        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-result-rematch')?.addEventListener('click', () => {
      this.audioMgr.playClick();
      this.hide();
      this.onRematchCallback();
    });

    this.modalRoot.querySelector('#btn-result-menu')?.addEventListener('click', () => {
      this.audioMgr.playClick();
      this.hide();
      this.onReturnToMenuCallback();
    });
  }

  public hide(): void {
    this.modalRoot.classList.add('hidden');
    this.modalRoot.innerHTML = '';
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
