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
      <div class="specialist-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <div class="specialist-card bg-white border border-slate-300 rounded-xl p-6 sm:p-8 max-w-[540px] w-full shadow-2xl space-y-6 text-slate-800 transition-all duration-200">
          
          <!-- Header -->
          <div class="text-center space-y-1 pb-2 border-b border-slate-200">
            <div class="font-bold tracking-widest text-slate-900 text-lg uppercase flex items-center justify-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
              EARTH // SHUKA
            </div>
            <div class="text-xs font-bold text-cyan-600 tracking-[0.25em] uppercase">
              MISSION SPECIALISTS
            </div>
            <p class="text-xs text-slate-500 max-w-sm mx-auto pt-1">
              Allocate your team's operational resources between Earth containment defense and Shuka core extraction.
            </p>
          </div>

          <!-- Total Counter Badge -->
          <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Resource Pool</span>
            <span class="font-mono font-bold text-sm text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded">
              ${SPECIALIST_CONFIG.totalSpecialists} SPECIALISTS
            </span>
          </div>

          <!-- Error Notification if any -->
          ${this.errorMessage ? `
            <div class="bg-rose-50 border border-rose-300 text-rose-700 px-3 py-2 rounded text-xs font-mono font-semibold flex items-center justify-between">
              <span>⚠ ${this.escapeHtml(this.errorMessage)}</span>
              <button id="btn-dismiss-err" class="text-rose-500 hover:text-rose-800 font-bold ml-2">×</button>
            </div>
          ` : ''}

          <!-- Confirmation Banner -->
          ${this.confirmationStatus ? `
            <div class="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-xs font-bold tracking-wider text-center animate-pulse flex items-center justify-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              ${this.confirmationStatus}
            </div>
          ` : ''}

          <!-- Role Allocation Sections -->
          <div class="space-y-4">
            
            <!-- 1. EARTH DEFENSE -->
            <div class="role-row bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg p-4 transition-colors">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 max-w-[280px]">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span class="font-bold text-slate-900 text-sm tracking-wider uppercase">EARTH DEFENSE</span>
                  </div>
                  <p class="text-[11px] text-slate-500 leading-snug">
                    Strengthens containment protocols and disruption abilities against alien activity on Earth.
                  </p>
                  <div class="text-[11px] font-mono text-rose-600 font-semibold pt-0.5">
                    +${earthBonusPct}% Disruption Readiness (+5%/specialist)
                  </div>
                </div>

                <!-- Controls / View -->
                <div class="flex items-center self-end sm:self-center gap-2">
                  ${this.isHost || this.isSolo ? `
                    <div class="flex items-center gap-2">
                      <button 
                        id="btn-earth-minus" 
                        class="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                        ${this.earthDefense <= 0 || this.isLocked ? 'disabled' : ''}
                        aria-label="Decrease Earth Defense Specialists"
                      >-</button>
                      <div class="w-10 text-center font-mono font-bold text-xl text-slate-900">
                        ${this.earthDefense}
                      </div>
                      <button 
                        id="btn-earth-plus" 
                        class="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                        ${this.earthDefense >= 5 || this.shukaExtraction <= 0 || this.isLocked ? 'disabled' : ''}
                        aria-label="Increase Earth Defense Specialists"
                      >+</button>
                    </div>
                  ` : `
                    <div class="bg-white border border-slate-200 px-3.5 py-2 rounded-lg font-mono font-bold text-slate-800 text-sm shadow-sm">
                      ${this.earthDefense} ${this.earthDefense === 1 ? 'Specialist' : 'Specialists'}
                    </div>
                  `}
                </div>
              </div>
            </div>

            <!-- 2. SHUKA EXTRACTION -->
            <div class="role-row bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg p-4 transition-colors">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 max-w-[280px]">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-cyan-500"></span>
                    <span class="font-bold text-slate-900 text-sm tracking-wider uppercase">SHUKA EXTRACTION</span>
                  </div>
                  <p class="text-[11px] text-slate-500 leading-snug">
                    Improves human extraction speed and beam stabilization efficiency on Shuka.
                  </p>
                  <div class="text-[11px] font-mono text-cyan-600 font-semibold pt-0.5">
                    +${shukaBonusPct}% Extraction Speed (~${finalDuration}s duration)
                  </div>
                </div>

                <!-- Controls / View -->
                <div class="flex items-center self-end sm:self-center gap-2">
                  ${this.isHost || this.isSolo ? `
                    <div class="flex items-center gap-2">
                      <button 
                        id="btn-shuka-minus" 
                        class="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                        ${this.shukaExtraction <= 0 || this.isLocked ? 'disabled' : ''}
                        aria-label="Decrease Shuka Extraction Specialists"
                      >-</button>
                      <div class="w-10 text-center font-mono font-bold text-xl text-slate-900">
                        ${this.shukaExtraction}
                      </div>
                      <button 
                        id="btn-shuka-plus" 
                        class="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                        ${this.shukaExtraction >= 5 || this.earthDefense <= 0 || this.isLocked ? 'disabled' : ''}
                        aria-label="Increase Shuka Extraction Specialists"
                      >+</button>
                    </div>
                  ` : `
                    <div class="bg-white border border-slate-200 px-3.5 py-2 rounded-lg font-mono font-bold text-slate-800 text-sm shadow-sm">
                      ${this.shukaExtraction} ${this.shukaExtraction === 1 ? 'Specialist' : 'Specialists'}
                    </div>
                  `}
                </div>
              </div>
            </div>

          </div>

          <!-- Total Allocated Status Bar -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-semibold">
            <span class="text-slate-600 uppercase tracking-wider">Total Allocated:</span>
            <span class="font-mono font-bold text-sm ${isValidTotal ? 'text-emerald-600' : 'text-rose-600'}">
              ${totalAllocated} / ${SPECIALIST_CONFIG.totalSpecialists}
            </span>
          </div>

          <!-- Action Area (Host confirm / Non-host waiting) -->
          <div class="pt-2">
            ${this.isHost || this.isSolo ? `
              <button 
                id="btn-confirm-allocation"
                class="w-full py-3.5 px-6 rounded-lg font-bold text-sm tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  isValidTotal && !this.isLocked 
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white active:scale-[0.99]' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }"
                ${!isValidTotal || this.isLocked ? 'disabled' : ''}
              >
                ${this.isLocked ? 'SPECIALISTS LOCKED' : 'CONFIRM ALLOCATION'}
              </button>
            ` : `
              <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>Waiting for mission host to confirm specialist allocation...</span>
              </div>
            `}
          </div>

          <!-- Role Explanatory Footer -->
          <div class="text-[11px] text-center text-slate-400 font-mono">
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
