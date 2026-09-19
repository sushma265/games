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
  isDemoMode?: boolean;
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

    let winnerTitle = 'MISSION COMPLETE';
    let winnerSubtitle = 'SHUKA WINS';

    if (isDraw) {
      winnerTitle = 'MISSION DRAW';
      winnerSubtitle = 'EQUAL SCORES';
    } else if (!isHumanWin) {
      winnerTitle = 'MISSION FAILED';
      winnerSubtitle = 'EARTH WINS';
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
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f4f8fb]/95 overflow-y-auto">
        <div class="game-card bg-white border border-[#d7e3e8] rounded-2xl p-8 max-w-lg w-full shadow-md space-y-6 text-[#10212b] text-center my-auto">
          
          <!-- Outcome Header -->
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#08a9c7]">
              ${winnerTitle}
            </div>
            <h1 class="text-3xl sm:text-4xl font-black font-display tracking-widest text-[#10212b] uppercase">
              ${winnerSubtitle}
            </h1>
          </div>

          <!-- Score Display Grid -->
          <div class="grid grid-cols-2 gap-4 py-4 border-y border-[#d7e3e8]">
            <div class="space-y-1">
              <div class="text-4xl font-black font-display text-[#08a9c7]">${stats.shukaCoresCollected}</div>
              <div class="text-xs font-mono font-bold text-[#5d707a] tracking-widest uppercase">SHUKA CORES</div>
            </div>
            <div class="space-y-1">
              <div class="text-4xl font-black font-display text-[#16a34a]">${stats.earthCoresLost}</div>
              <div class="text-xs font-mono font-bold text-[#5d707a] tracking-widest uppercase">EARTH CORES</div>
            </div>
          </div>

          <!-- Match Details -->
          <div class="grid grid-cols-2 gap-3 text-xs font-mono text-left bg-[#edf5f8] p-4 rounded-xl border border-[#d7e3e8]">
            <div>
              <span class="text-[#5d707a] block text-[10px] uppercase font-bold">MATCH DURATION</span>
              <span class="font-bold text-[#10212b] text-sm">${formattedDuration}</span>
            </div>
            <div>
              <span class="text-[#5d707a] block text-[10px] uppercase font-bold">ABILITIES DEPLOYED</span>
              <span class="font-bold text-[#10212b] text-sm">${stats.abilitiesUsed || 0}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button id="btn-result-rematch" class="btn-primary flex-1 py-3.5 text-xs">
              PLAY AGAIN
            </button>
            <button id="btn-result-menu" class="btn-secondary flex-1 py-3.5 text-xs">
              RETURN TO LOBBY
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
