import { NetworkManager } from '../network/NetworkManager';
import { AudioManager } from '../core/AudioManager';
import { SpecialistAllocation, SPECIALIST_CONFIG } from '../types';

export interface SpecialistAllocationUIOptions {
  container: HTMLElement;
  networkMgr: NetworkManager;
  audioMgr: AudioManager;
  isHost: boolean;
  isSolo: boolean;
  onConfirmed: (allocation: SpecialistAllocation) => void;
}

/**
 * SpecialistAllocationUI
 * Implements Phase 10: 5-Specialist Allocation System
 * 
 * Features:
 * - Server-authoritative state synchronization in multiplayer
 * - Host control rule (host sets [-][+] & confirms, non-hosts view live)
 * - Solo reconnaissance protocol support
 * - Enforces invariant: Earth Defense + Shuka Extraction === 5
 * - Clean, responsive, high-contrast light theme
 * - Touch-friendly buttons (min 44px) with instant tactile feedback
 */
export class SpecialistAllocationUI {
  private container: HTMLElement;
  private networkMgr: NetworkManager;
  private audioMgr: AudioManager;
  private isHost: boolean;
  private isSolo: boolean;
  private onConfirmedCallback: (allocation: SpecialistAllocation) => void;

  public earthDefense: number = SPECIALIST_CONFIG.defaultEarthDefense;
  public shukaExtraction: number = SPECIALIST_CONFIG.defaultShukaExtraction;
  public isLocked: boolean = false;
  public confirmationStatus: string = '';
  public errorMessage: string | null = null;

  private unsubs: (() => void)[] = [];

  constructor(options: SpecialistAllocationUIOptions) {
    this.container = options.container;
    this.networkMgr = options.networkMgr;
    this.audioMgr = options.audioMgr;
    this.isHost = options.isHost;
    this.isSolo = options.isSolo;
    this.onConfirmedCallback = options.onConfirmed;

    // Pull initial values from NetworkManager if present
    if (this.networkMgr.specialists) {
      this.earthDefense = this.networkMgr.specialists.earthDefense;
      this.shukaExtraction = this.networkMgr.specialists.shukaExtraction;
      this.isLocked = this.networkMgr.specialists.isLocked;
    }

    this.setupListeners();
    this.render();
  }

  public setHostStatus(isHost: boolean): void {
    this.isHost = isHost;
    this.render();
  }

  private setupListeners(): void {
    // 1. Listen for allocation updates from server (for non-hosts and syncing host)
    const unsubUpdate = this.networkMgr.on('SPECIALIST_ALLOCATION_UPDATED', (data: any) => {
      if (typeof data.earthDefense === 'number' && typeof data.shukaExtraction === 'number') {
        this.earthDefense = data.earthDefense;
        this.shukaExtraction = data.shukaExtraction;
        this.errorMessage = null;
        this.render();
      }
    });
    this.unsubs.push(unsubUpdate);

    // 2. Listen for confirmation
    const unsubConfirm = this.networkMgr.on('SPECIALIST_ALLOCATION_CONFIRMED', (data: any) => {
      this.isLocked = true;
      if (data.specialists) {
        this.earthDefense = data.specialists.earthDefense;
        this.shukaExtraction = data.specialists.shukaExtraction;
      }
      this.confirmationStatus = 'Specialist allocation confirmed. Specialists locked.';
      this.render();
      this.audioMgr.playScanPing();

      setTimeout(() => {
        this.onConfirmedCallback({
          total: 5,
          earthDefense: this.earthDefense,
          shukaExtraction: this.shukaExtraction,
          isLocked: true
        });
      }, 700);
    });
    this.unsubs.push(unsubConfirm);

    // 3. Listen for allocation errors
    const unsubError = this.networkMgr.on('SPECIALIST_ALLOCATION_ERROR', (data: { message: string }) => {
      this.errorMessage = data.message;
      this.render();
    });
    this.unsubs.push(unsubError);

    // 4. Listen for host change
    const unsubHost = this.networkMgr.on('HOST_CHANGED', (data: { newHostId: string }) => {
      const amIHost = this.networkMgr.localPlayerId === data.newHostId;
      this.setHostStatus(amIHost);
    });
    this.unsubs.push(unsubHost);
  }

  public render(): void {
    const totalAllocated = this.earthDefense + this.shukaExtraction;
    const isValidTotal = totalAllocated === SPECIALIST_CONFIG.totalSpecialists;

    // Modifiers computation
    const earthBonusPct = Math.round(this.earthDefense * SPECIALIST_CONFIG.earthDefenseBonusPerSpecialist * 100);
    const shukaBonusPct = Math.round(this.shukaExtraction * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist * 100);
    const baseDuration = SPECIALIST_CONFIG.baseShukaExtractionTime;
    const finalDuration = (baseDuration / (1 + this.shukaExtraction * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist)).toFixed(2);

    this.container.innerHTML = `
      <div class="specialist-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f4f8fb]/95 overflow-y-auto">
        <div class="specialist-card game-card bg-white border border-[#d7e3e8] rounded-2xl p-6 sm:p-8 max-w-[540px] w-full shadow-md space-y-6 text-[#10212b]">
          
          <!-- Header -->
          <div class="text-center space-y-1 pb-3 border-b border-[#d7e3e8]">
            <div class="text-xs font-mono font-bold text-[#08a9c7] tracking-[0.25em] uppercase">
              STRATEGY PANEL
            </div>
            <h2 class="font-display font-bold tracking-wider text-[#10212b] text-2xl uppercase">
              SPECIALIST ALLOCATION
            </h2>
            <div class="text-xs font-mono font-bold text-[#5d707a] tracking-wider pt-1 uppercase">
              ${SPECIALIST_CONFIG.totalSpecialists} SPECIALISTS AVAILABLE
            </div>
          </div>

          <!-- Error Notification if any -->
          ${this.errorMessage ? `
            <div class="bg-rose-50 border border-rose-300 text-rose-700 px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center justify-between">
              <span>${this.escapeHtml(this.errorMessage)}</span>
              <button id="btn-dismiss-err" class="text-rose-500 hover:text-rose-800 font-bold ml-2">×</button>
            </div>
          ` : ''}

          <!-- Confirmation Banner -->
          ${this.confirmationStatus ? `
            <div class="bg-[#dff7fb] border border-[#08a9c7] text-[#0789a3] px-4 py-3 rounded-xl text-xs font-bold tracking-wider text-center flex items-center justify-center gap-2">
              ${this.confirmationStatus}
            </div>
          ` : ''}

          <!-- Visual Balance Bar -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-mono font-bold uppercase text-[#5d707a]">
              <span>EARTH DEFENSE (${this.earthDefense})</span>
              <span>SHUKA EXTRACTION (${this.shukaExtraction})</span>
            </div>
            <div class="w-full h-3 bg-[#edf5f8] rounded-full overflow-hidden flex border border-[#d7e3e8]">
              <div class="h-full bg-[#2563eb] transition-all duration-200" style="width: ${(this.earthDefense / 5) * 100}%"></div>
              <div class="h-full bg-[#08a9c7] transition-all duration-200" style="width: ${(this.shukaExtraction / 5) * 100}%"></div>
            </div>
          </div>

          <!-- Role Allocation Rows -->
          <div class="space-y-4">
            
            <!-- 1. EARTH DEFENSE -->
            <div class="role-row bg-[#edf5f8] border border-[#d7e3e8] rounded-xl p-4 flex items-center justify-between">
              <div class="space-y-1">
                <span class="font-bold text-[#10212b] text-sm tracking-wider uppercase">EARTH DEFENSE</span>
                <p class="text-xs text-[#5d707a]">Disruption readiness vs Alien operative on Earth.</p>
                <div class="text-xs font-mono text-[#2563eb] font-bold">+${earthBonusPct}% Disruption Readiness</div>
              </div>

              <!-- Controls -->
              <div class="flex items-center gap-3">
                ${this.isHost || this.isSolo ? `
                  <button 
                    id="btn-earth-minus" 
                    class="btn-secondary w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold"
                    ${this.earthDefense <= 0 || this.isLocked ? 'disabled' : ''}
                  >-</button>
                  <span class="font-display font-bold text-2xl text-[#10212b] w-6 text-center">${this.earthDefense}</span>
                  <button 
                    id="btn-earth-plus" 
                    class="btn-secondary w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold"
                    ${this.earthDefense >= 5 || this.shukaExtraction <= 0 || this.isLocked ? 'disabled' : ''}
                  >+</button>
                ` : `
                  <span class="font-display font-bold text-2xl text-[#10212b]">${this.earthDefense}</span>
                `}
              </div>
            </div>

            <!-- 2. SHUKA EXTRACTION -->
            <div class="role-row bg-[#edf5f8] border border-[#d7e3e8] rounded-xl p-4 flex items-center justify-between">
              <div class="space-y-1">
                <span class="font-bold text-[#10212b] text-sm tracking-wider uppercase">SHUKA EXTRACTION</span>
                <p class="text-xs text-[#5d707a]">Accelerates core extraction speed on Shuka.</p>
                <div class="text-xs font-mono text-[#08a9c7] font-bold">+${shukaBonusPct}% Speed (~${finalDuration}s)</div>
              </div>

              <!-- Controls -->
              <div class="flex items-center gap-3">
                ${this.isHost || this.isSolo ? `
                  <button 
                    id="btn-shuka-minus" 
                    class="btn-secondary w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold"
                    ${this.shukaExtraction <= 0 || this.isLocked ? 'disabled' : ''}
                  >-</button>
                  <span class="font-display font-bold text-2xl text-[#10212b] w-6 text-center">${this.shukaExtraction}</span>
                  <button 
                    id="btn-shuka-plus" 
                    class="btn-secondary w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold"
                    ${this.shukaExtraction >= 5 || this.earthDefense <= 0 || this.isLocked ? 'disabled' : ''}
                  >+</button>
                ` : `
                  <span class="font-display font-bold text-2xl text-[#10212b]">${this.shukaExtraction}</span>
                `}
              </div>
            </div>

          </div>

          <!-- Action Area -->
          <div class="pt-2">
            ${this.isHost || this.isSolo ? `
              <button 
                id="btn-confirm-allocation"
                class="btn-primary w-full py-3.5 text-xs font-bold"
                ${!isValidTotal || this.isLocked ? 'disabled' : ''}
              >
                ${this.isLocked ? 'SPECIALISTS LOCKED' : 'CONFIRM ALLOCATION'}
              </button>
            ` : `
              <div class="bg-[#edf5f8] border border-[#d7e3e8] rounded-xl p-3 text-center text-xs text-[#5d707a] font-semibold">
                Waiting for mission host to confirm specialist allocation...
              </div>
            `}
          </div>

          <!-- Role Explanatory Footer -->
          <div class="text-[11px] text-center text-[#5d707a] font-mono font-bold uppercase">
            ${this.isSolo ? 'SOLO RECONNAISSANCE MODE' : (this.isHost ? 'TEAM LEADER // HOST CONTROL' : 'OPERATIVE STATUS // TEAM ALLOCATION')}
          </div>

        </div>
      </div>
    `;

    this.attachDomHandlers();
  }

  private attachDomHandlers(): void {
    // Dismiss error button
    this.container.querySelector('#btn-dismiss-err')?.addEventListener('click', () => {
      this.errorMessage = null;
      this.render();
    });

    if (!this.isHost && !this.isSolo) return;
    if (this.isLocked) return;

    // Button: Earth Defense [+] -> Increase Earth Defense, decrease Shuka Extraction
    this.container.querySelector('#btn-earth-plus')?.addEventListener('click', () => {
      if (this.earthDefense < 5 && this.shukaExtraction > 0) {
        this.audioMgr.playClick();
        this.updateAllocation(this.earthDefense + 1, this.shukaExtraction - 1);
      }
    });

    // Button: Earth Defense [-] -> Decrease Earth Defense, increase Shuka Extraction
    this.container.querySelector('#btn-earth-minus')?.addEventListener('click', () => {
      if (this.earthDefense > 0 && this.shukaExtraction < 5) {
        this.audioMgr.playClick();
        this.updateAllocation(this.earthDefense - 1, this.shukaExtraction + 1);
      }
    });

    // Button: Shuka Extraction [+] -> Increase Shuka Extraction, decrease Earth Defense
    this.container.querySelector('#btn-shuka-plus')?.addEventListener('click', () => {
      if (this.shukaExtraction < 5 && this.earthDefense > 0) {
        this.audioMgr.playClick();
        this.updateAllocation(this.earthDefense - 1, this.shukaExtraction + 1);
      }
    });

    // Button: Shuka Extraction [-] -> Decrease Shuka Extraction, increase Earth Defense
    this.container.querySelector('#btn-shuka-minus')?.addEventListener('click', () => {
      if (this.shukaExtraction > 0 && this.earthDefense < 5) {
        this.audioMgr.playClick();
        this.updateAllocation(this.earthDefense + 1, this.shukaExtraction - 1);
      }
    });

    // Confirm button
    this.container.querySelector('#btn-confirm-allocation')?.addEventListener('click', () => {
      this.triggerConfirm();
    });
  }

  private async updateAllocation(earthDefense: number, shukaExtraction: number): Promise<void> {
    if (earthDefense + shukaExtraction !== SPECIALIST_CONFIG.totalSpecialists) {
      this.errorMessage = `Total specialists must equal ${SPECIALIST_CONFIG.totalSpecialists}`;
      this.render();
      return;
    }

    this.earthDefense = earthDefense;
    this.shukaExtraction = shukaExtraction;
    this.errorMessage = null;

    if (this.isSolo) {
      // Local solo update
      this.render();
    } else {
      // Send to server in multiplayer
      const res = await this.networkMgr.setSpecialistAllocation(earthDefense, shukaExtraction);
      if (!res.success) {
        this.errorMessage = res.error || 'Failed to update specialist allocation';
      }
      this.render();
    }
  }

  private async triggerConfirm(): Promise<void> {
    if (this.earthDefense + this.shukaExtraction !== SPECIALIST_CONFIG.totalSpecialists) {
      this.errorMessage = `Total specialists must equal exactly ${SPECIALIST_CONFIG.totalSpecialists}`;
      this.render();
      return;
    }

    this.isLocked = true;
    this.audioMgr.playClick();

    if (this.isSolo) {
      // Solo mode: immediate local confirmation
      this.confirmationStatus = 'Specialist allocation confirmed. Specialists locked.';
      this.render();
      this.audioMgr.playScanPing();

      setTimeout(() => {
        this.onConfirmedCallback({
          total: SPECIALIST_CONFIG.totalSpecialists,
          earthDefense: this.earthDefense,
          shukaExtraction: this.shukaExtraction,
          isLocked: true
        });
      }, 700);
    } else {
      // Multiplayer: host confirms with server
      const res = await this.networkMgr.confirmSpecialistAllocation();
      if (!res.success) {
        this.isLocked = false;
        this.errorMessage = res.error || 'Failed to confirm specialist allocation';
        this.render();
      }
      // On success, the server emits SPECIALIST_ALLOCATION_CONFIRMED which is handled in listener!
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public destroy(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    this.container.innerHTML = '';
  }
}
