import { GameManager, GameState } from '../core/GameManager';
import { CoreController, CoreState } from '../gameplay/CoreController';
import { CoreManager } from '../gameplay/CoreManager';

function makeProgressBar(current: number, total: number = 5): string {
  let res = '';
  for (let i = 0; i < total; i++) {
    res += i < current ? '█' : '░';
  }
  return res;
}

function makePercentBar(pct: number, length: number = 14): string {
  const filled = Math.round(Math.min(1.0, Math.max(0.0, pct)) * length);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += i < filled ? '█' : '░';
  }
  return res;
}

/**
 * Phase5DebugHUD - Tactical HUD for Earth // Shuka Race:
 * Displays:
 *  EARTH // SHUKA
 *  HUMAN — SHUKA
 *  ███░░ 3 / 5
 *  ALIEN — EARTH
 *  ██░░░ 2 / 5
 *  ALIEN TARGET: EARTH CORE 3
 *  ALIEN EXTRACTION: ████████░░░░░░ 60%
 *  TIME: 04:59 | STATE: PLAYING
 *  DEBUG_AI mode (toggleable via [F2] or button)
 *  RECON CAM toggle [V]
 */
export class Phase5DebugHUD {
  public isDemoMode: boolean = false;
  private container: HTMLElement;
  private debugPanel: HTMLElement;
  private statusBannerRoot: HTMLElement;
  private promptRoot: HTMLElement;
  private abilityBarRoot: HTMLElement;
  private scanWaypointRoot: HTMLElement;
  private abilityFeedbackRoot: HTMLElement;
  private onResetCallback: () => void;
  private onPauseToggleCallback: () => void;

  // Track recently collected core for celebration banner
  private recentlyCollectedName: string = '';
  private recentlyCollectedTimer: number = 0;

  // Cache to avoid unnecessary DOM thrashing
  private lastRenderedKey: string = '';
  private lastAbilityKey: string = '';

  constructor(
    parent: HTMLElement,
    onReset: () => void,
    onPauseToggle: () => void
  ) {
    this.container = parent;
    this.onResetCallback = onReset;
    this.onPauseToggleCallback = onPauseToggle;

    this.container.innerHTML = '';
    this.container.classList.remove('hidden');

    // 1. Tactical Debug Panel (Top-Left)
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'phase5-debug-panel';
    this.debugPanel.className =
      'pointer-events-auto absolute top-4 left-4 z-30 select-none';
    this.container.appendChild(this.debugPanel);

    // 2. Status / End Banner (Center Screen for WON / LOST / PAUSED)
    this.statusBannerRoot = document.createElement('div');
    this.statusBannerRoot.id = 'phase5-status-banner-root';
    this.statusBannerRoot.className =
      'pointer-events-auto absolute inset-0 flex items-center justify-center z-40 bg-slate-950/70 backdrop-blur-sm hidden';
    this.container.appendChild(this.statusBannerRoot);

    // 3. In-world Core Interaction Prompt (Bottom-Center)
    this.promptRoot = document.createElement('div');
    this.promptRoot.id = 'phase5-core-prompt-root';
    this.promptRoot.className =
      'pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center justify-center z-20 transition-all duration-150';
    this.container.appendChild(this.promptRoot);

    // 4. Scan Waypoint Tracker (Top-Center)
    this.scanWaypointRoot = document.createElement('div');
    this.scanWaypointRoot.id = 'phase11-scan-waypoint-root';
    this.scanWaypointRoot.className =
      'pointer-events-none absolute top-6 inset-x-0 flex justify-center z-20 transition-all duration-150';
    this.container.appendChild(this.scanWaypointRoot);

    // 5. Tactical Ability Feedback Banner (Center-Bottom above prompt)
    this.abilityFeedbackRoot = document.createElement('div');
    this.abilityFeedbackRoot.id = 'phase11-ability-feedback-root';
    this.abilityFeedbackRoot.className =
      'pointer-events-none absolute bottom-40 inset-x-0 flex justify-center z-25 transition-all duration-150';
    this.container.appendChild(this.abilityFeedbackRoot);

    // 6. Phase 11 Ability Cards Bar (Bottom-Right)
    this.abilityBarRoot = document.createElement('div');
    this.abilityBarRoot.id = 'phase11-ability-bar-root';
    this.abilityBarRoot.className =
      'pointer-events-auto absolute bottom-6 right-6 z-30 select-none flex flex-col items-end gap-2.5';
    this.container.appendChild(this.abilityBarRoot);

    // Listen for core collection to trigger popup
    window.addEventListener('CORE_COLLECTED', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.recentlyCollectedName = detail?.coreId ? detail.coreId.toUpperCase() : 'SHUKA CORE';
      this.recentlyCollectedTimer = 2.5; // Display for 2.5s
    });
  }

  public update(gameManager: GameManager, coreSource: CoreManager | CoreController): void {
    if (gameManager.state === GameState.MENU || gameManager.state === GameState.LOBBY || gameManager.state === GameState.COUNTDOWN) {
      this.container.classList.add('hidden');
      return;
    }
    this.container.classList.remove('hidden');

    const deltaSeconds = 0.016;
    if (this.recentlyCollectedTimer > 0) {
      this.recentlyCollectedTimer -= deltaSeconds;
    }

    this.renderDebugPanel(gameManager);
    this.renderStatusBanner(gameManager);
    this.renderCorePrompt(coreSource, gameManager);
    this.renderAbilities(gameManager);
    this.renderWaypoint(gameManager);
    this.renderAbilityFeedback(gameManager);
  }

  private renderDebugPanel(gm: GameManager): void {
    const formattedTime = gm.getFormattedTime();
    const isExtracting = gm.alienAI?.state === 'EXTRACTING';
    const extPct = isExtracting ? Math.floor((gm.alienAI?.extractionProgress || 0) * 100) : 0;
    const isLowTime = gm.matchTime > 240; // match time > 4 mins (last 60s)

    const cacheKey = `${gm.state}_${gm.humanCores}_${gm.alienCores}_${formattedTime}_${isExtracting}_${extPct}_${gm.playerRole}_${gm.isReconCameraActive}`;
    if (this.lastRenderedKey === cacheKey) {
      return;
    }
    this.lastRenderedKey = cacheKey;

    // Render dot indicators ● ● ● ○ ○
    const renderDots = (count: number, max: number, type: 'human' | 'alien') => {
      let dots = '';
      for (let i = 0; i < max; i++) {
        const filled = i < count ? (type === 'human' ? 'filled-human' : 'filled-alien') : '';
        dots += `<span class="core-dot ${filled}"></span>`;
      }
      return dots;
    };

    const specialistsCount = gm.specialistAllocation?.shukaExtraction ?? 3;

    this.debugPanel.innerHTML = `
      <div class="hud-container">
        <!-- Top-Left: Branding & Mission -->
        <div class="hud-top-left hud-panel">
          <div class="hud-brand-title">EARTH // SHUKA</div>
          <div class="hud-mission-id">MISSION 01 ${gm.roomCode ? `[${gm.roomCode}]` : ''}</div>
        </div>

        <!-- Top-Center: Match Timer -->
        <div class="hud-top-center">
          <div class="hud-timer-card">
            <span class="hud-timer-text ${isLowTime ? 'warning' : ''}">${formattedTime}</span>
          </div>
        </div>

        <!-- Top-Right: Score Cards & Core Progress Dots -->
        <div class="hud-top-right">
          <!-- Shuka Cores Card -->
          <div class="hud-panel hud-score-card">
            <span class="hud-score-label">SHUKA</span>
            <span class="hud-score-num human">${gm.humanCores}</span>
            <div class="hud-dots">${renderDots(gm.humanCores, gm.MAX_CORES, 'human')}</div>
          </div>

          <!-- Earth Cores Card -->
          <div class="hud-panel hud-score-card">
            <span class="hud-score-label">EARTH</span>
            <span class="hud-score-num alien">${gm.alienCores}</span>
            <div class="hud-dots">${renderDots(gm.alienCores, gm.MAX_CORES, 'alien')}</div>
          </div>
        </div>

        <!-- Bottom-Left: Player Stats -->
        <div class="hud-bottom-left hud-panel">
          <div class="hud-player-name">${this.escapeHtml(gm.networkMgr?.localPlayerName || 'OPERATIVE')}</div>
          <div class="hud-specialist-info">SPECIALISTS: ${specialistsCount}</div>
        </div>
      </div>
    `;

    const resetBtn = this.debugPanel.querySelector('#p5-hud-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onResetCallback();
      });
    }

    const camBtn = this.debugPanel.querySelector('#p5-hud-cam-btn');
    if (camBtn) {
      camBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gm.toggleReconCamera();
      });
    }

    const debugAiBtn = this.debugPanel.querySelector('#p5-hud-debug-ai-btn');
    if (debugAiBtn) {
      debugAiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        (window as any).DEBUG_AI = !(window as any).DEBUG_AI;
      });
    }

    const pauseBtn = this.debugPanel.querySelector('#p5-hud-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPauseToggleCallback();
      });
    }
  }

  private renderStatusBanner(gm: GameManager): void {
    if (gm.state === GameState.WON) {
      this.statusBannerRoot.classList.remove('hidden');
      this.statusBannerRoot.innerHTML = `
        <div class="bg-slate-950/95 border-2 border-emerald-400 rounded-2xl p-8 max-w-md w-full mx-4 shadow-[0_0_50px_rgba(52,211,153,0.4)] text-center space-y-4 animate-in fade-in zoom-in duration-200">
          <div class="text-xs font-mono text-emerald-300 tracking-[0.3em] uppercase">
            OBJECTIVE COMPLETE
          </div>
          <div class="text-3xl font-black text-emerald-400 font-mono tracking-wider drop-shadow-[0_0_15px_rgba(52,211,153,0.7)]">
            HUMANITY VICTORIOUS
          </div>
          <div class="text-base font-mono text-slate-100 tracking-widest font-bold border-t border-b border-emerald-900/60 py-3">
            5 / 5 SHUKA CORES SECURED
          </div>
          <div class="text-xs font-mono text-slate-400">
            FINAL TIME: ${gm.getFormattedTime()} | SHUKA: 5 / 5 | EARTH: ${gm.alienCores} / 5
          </div>
          <div class="pt-2">
            <button id="p5-banner-reset-btn" class="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-sm tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(52,211,153,0.5)] cursor-pointer active:scale-98">
              PLAY AGAIN [R]
            </button>
          </div>
        </div>
      `;
      this.attachBannerReset();
      return;
    }

    if (gm.state === GameState.LOST) {
      this.statusBannerRoot.classList.remove('hidden');
      const isAlienWin = gm.alienCores >= gm.MAX_CORES;
      this.statusBannerRoot.innerHTML = `
        <div class="bg-slate-950/95 border-2 border-rose-500 rounded-2xl p-8 max-w-md w-full mx-4 shadow-[0_0_50px_rgba(244,63,94,0.4)] text-center space-y-4 animate-in fade-in zoom-in duration-200">
          <div class="text-xs font-mono text-rose-400 tracking-[0.3em] uppercase">
            MATCH TERMINATED
          </div>
          <div class="text-3xl font-black text-rose-500 font-mono tracking-wider drop-shadow-[0_0_15px_rgba(244,63,94,0.7)]">
            ${isAlienWin ? 'ALIEN HARVEST COMPLETE' : 'MISSION FAILED'}
          </div>
          <div class="text-sm font-mono text-slate-300 tracking-widest border-t border-b border-rose-950 py-3">
            ${isAlienWin ? 'ALIEN SECURED 5 / 5 EARTH CORES' : 'CRITICAL TIME LIMIT EXPIRED'}
          </div>
          <div class="text-xs font-mono text-slate-400">
            FINAL TIME: ${gm.getFormattedTime()} | HUMAN: ${gm.humanCores}/5 | ALIEN: ${gm.alienCores}/5
          </div>
          <div class="pt-2">
            <button id="p5-banner-reset-btn" class="w-full py-3 bg-rose-600 hover:bg-rose-500 text-slate-100 font-mono font-bold text-sm tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(244,63,94,0.5)] cursor-pointer active:scale-98">
              RETRY MATCH [R]
            </button>
          </div>
        </div>
      `;
      this.attachBannerReset();
      return;
    }

    if (gm.state === GameState.PAUSED) {
      this.statusBannerRoot.classList.remove('hidden');
      this.statusBannerRoot.innerHTML = `
        <div class="bg-slate-950/90 border border-amber-400/80 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center space-y-3">
          <div class="text-2xl font-black text-amber-300 font-mono tracking-widest">
            MATCH PAUSED
          </div>
          <div class="text-xs font-mono text-slate-300">
            Press [P] or click below to resume.
          </div>
          <div class="pt-2 flex gap-2">
            <button id="p5-banner-resume-btn" class="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs tracking-wider rounded transition-colors cursor-pointer">
              RESUME [P]
            </button>
            <button id="p5-banner-reset-btn" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs rounded transition-colors cursor-pointer">
              RESET [R]
            </button>
          </div>
        </div>
      `;
      const resumeBtn = this.statusBannerRoot.querySelector('#p5-banner-resume-btn');
      if (resumeBtn) {
        resumeBtn.addEventListener('click', () => this.onPauseToggleCallback());
      }
      this.attachBannerReset();
      return;
    }

    // Default: hide overlay banner
    this.statusBannerRoot.classList.add('hidden');
    this.statusBannerRoot.innerHTML = '';
  }

  private attachBannerReset(): void {
    const bannerReset = this.statusBannerRoot.querySelector('#p5-banner-reset-btn');
    if (bannerReset) {
      bannerReset.addEventListener('click', () => {
        this.onResetCallback();
      });
    }
  }

  private renderCorePrompt(coreSource: CoreManager | CoreController, gm: GameManager): void {
    if (gm.state !== GameState.PLAYING) {
      this.promptRoot.innerHTML = '';
      return;
    }

    if (this.recentlyCollectedTimer > 0) {
      this.promptRoot.innerHTML = `
        <div class="bg-emerald-950/95 border-2 border-emerald-400 text-emerald-300 px-6 py-3 rounded-xl font-mono text-sm font-bold tracking-widest shadow-[0_0_30px_rgba(52,211,153,0.5)] animate-in fade-in zoom-in-95 duration-150">
          +1 SHUKA ENERGY CORE [${this.recentlyCollectedName}]
        </div>
      `;
      return;
    }

    let core: CoreController | null = null;
    if ('cores' in coreSource && Array.isArray(coreSource.cores)) {
      core = coreSource.getActiveExtractingCore() ||
             coreSource.getNearestAvailableCore(gm.playerCtrl.root.position);
    } else {
      core = coreSource as CoreController;
    }

    if (!core) {
      this.promptRoot.innerHTML = '';
      return;
    }

    if (core.showCancelledFeedback) {
      this.promptRoot.innerHTML = `
        <div class="bg-rose-950/90 border border-rose-500/80 text-rose-300 px-5 py-2.5 rounded-lg font-mono text-xs font-bold tracking-wider shadow-lg animate-pulse">
          EXTRACTION CANCELLED
        </div>
      `;
      return;
    }

    if (core.state === CoreState.EXTRACTING) {
      const pct = Math.floor(core.extractionProgress * 100);
      const progressBar = makePercentBar(core.extractionProgress, 12);
      this.promptRoot.innerHTML = `
        <div class="bg-slate-950/95 border border-cyan-400 rounded-xl px-6 py-3.5 flex flex-col items-center gap-1.5 shadow-[0_0_25px_rgba(34,211,238,0.4)]">
          <div class="text-cyan-300 font-mono text-xs font-bold tracking-widest animate-pulse">
            EXTRACTING ${core.name.toUpperCase()}...
          </div>
          <div class="text-cyan-400 font-mono text-sm tracking-wider font-bold">
            ${progressBar} ${pct}%
          </div>
          <div class="text-[10px] font-mono text-slate-400">
            HOLD [SPACE / F] TO MAINTAIN QUANTUM BEAM
          </div>
        </div>
      `;
      return;
    }

    if (core.isPlayerInRange && core.state === CoreState.AVAILABLE) {
      this.promptRoot.innerHTML = `
        <div class="bg-slate-950/90 border border-cyan-500/60 rounded-xl px-6 py-3 flex items-center gap-3 shadow-[0_0_20px_rgba(34,211,238,0.3)] animate-bounce duration-1000">
          <div class="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-mono font-bold text-cyan-300 text-xs">
            SPACE / F
          </div>
          <div class="flex flex-col">
            <span class="font-mono text-xs font-bold tracking-wider text-slate-100">HOLD [SPACE / F] TO EXTRACT</span>
            <span class="font-mono text-[10px] text-cyan-400">${core.name} (${core.playerDistance.toFixed(1)}m)</span>
          </div>
        </div>
      `;
      return;
    }

    if (core.state === CoreState.AVAILABLE && core.playerDistance < 50) {
      this.promptRoot.innerHTML = `
        <div class="bg-slate-950/70 border border-slate-700/60 rounded-lg px-3 py-1.5 font-mono text-[11px] text-slate-400">
          CORE DETECTED: <span class="text-cyan-300 font-bold">${core.name}</span> (${core.playerDistance.toFixed(0)}m)
        </div>
      `;
      return;
    }

    this.promptRoot.innerHTML = '';
  }

  /**
   * Phase 11: Render Player Ability Cards (EMP SURGE, OVERCHARGE, SCAN)
   */
  private renderAbilities(gm: GameManager): void {
    if (gm.state !== GameState.PLAYING || !gm.abilitySys) {
      this.abilityBarRoot.innerHTML = '';
      return;
    }

    const a1 = gm.abilitySys.getAbilityCardState(1); // EMP SURGE [E]
    const a2 = gm.abilitySys.getAbilityCardState(2); // OVERCHARGE [Q]
    const a3 = gm.abilitySys.getAbilityCardState(3); // SCAN [R]

    const cacheKey = `${a1.currentCooldown.toFixed(1)}_${a1.isActive}_${a2.currentCooldown.toFixed(1)}_${a2.isActive}_${a3.currentCooldown.toFixed(1)}_${a3.isActive}_${gm.alienAI?.state}`;
    if (this.lastAbilityKey === cacheKey) {
      return;
    }
    this.lastAbilityKey = cacheKey;

    const renderCard = (ability: typeof a1) => {
      const isReady = ability.currentCooldown <= 0;
      const isCoolingDown = !isReady;
      const cdSec = Math.ceil(ability.currentCooldown);

      return `
        <button
          data-ability-id="${ability.id}"
          class="ability-card ${ability.isActive ? 'border-[#08a9c7]' : ''}"
        >
          <div class="ability-header">
            <span class="ability-key">${ability.hotkey}</span>
            <span class="ability-name">${ability.name}</span>
          </div>
          <div class="text-[10px] font-mono text-[#5d707a] flex justify-between">
            <span>${isReady ? 'READY' : `${cdSec}s`}</span>
            <span>${ability.cooldownMax}s</span>
          </div>
          <div class="ability-cooldown-bar">
            <div class="ability-cooldown-fill" style="width: ${((ability.cooldownMax - (isCoolingDown ? ability.currentCooldown : 0)) / ability.cooldownMax) * 100}%"></div>
          </div>
        </button>
      `;
    };

    this.abilityBarRoot.innerHTML = `
      <div class="hud-bottom-right">
        ${renderCard(a1)}
        ${renderCard(a2)}
        ${renderCard(a3)}
      </div>
    `;

    // Attach click triggers
    const buttons = this.abilityBarRoot.querySelectorAll('button[data-ability-id]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute('data-ability-id') || '0', 10) as 1 | 2 | 3;
        if (id && gm.abilitySys) {
          gm.abilitySys.activateAbility(id);
        }
      });
    });
  }

  /**
   * Phase 11: Long-Range Recon Scan Waypoint Tracker
   */
  private renderWaypoint(gm: GameManager): void {
    if (gm.state !== GameState.PLAYING || !gm.abilitySys) {
      this.scanWaypointRoot.innerHTML = '';
      return;
    }

    if (gm.abilitySys.cooldownMgr.isEffectActive('SCAN') && gm.abilitySys.scanTargetCoreId) {
      const dist = Math.round(gm.abilitySys.scanTargetDistance);
      const name = gm.abilitySys.scanTargetCoreName || 'SHUKA CORE';

      this.scanWaypointRoot.innerHTML = `
        <div class="bg-slate-950/90 border-2 border-emerald-400 px-6 py-2 rounded-xl shadow-[0_0_30px_rgba(52,211,153,0.5)] font-mono flex items-center gap-3 text-emerald-300 animate-in fade-in duration-200">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span class="text-xs font-bold tracking-widest uppercase">RECON SCAN LOCKED:</span>
          <span class="text-sm font-black text-slate-100">${name.toUpperCase()}</span>
          <span class="text-xs font-bold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/60">${dist}m</span>
        </div>
      `;
    } else {
      this.scanWaypointRoot.innerHTML = '';
    }
  }

  /**
   * Phase 11: Tactical Ability Feedback Banner (Toasts)
   */
  private renderAbilityFeedback(gm: GameManager): void {
    if (gm.state !== GameState.PLAYING || !gm.abilitySys || !gm.abilitySys.currentFeedback) {
      this.abilityFeedbackRoot.innerHTML = '';
      return;
    }

    const fb = gm.abilitySys.currentFeedback;
    let colorClasses = 'border-cyan-500 text-cyan-200 bg-slate-950/95 shadow-[0_0_20px_rgba(34,211,238,0.3)]';
    if (fb.type === 'warning') {
      colorClasses = 'border-amber-500 text-amber-200 bg-slate-950/95 shadow-[0_0_20px_rgba(245,158,11,0.3)]';
    } else if (fb.type === 'error') {
      colorClasses = 'border-rose-500 text-rose-200 bg-slate-950/95 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
    } else if (fb.type === 'success') {
      colorClasses = 'border-emerald-500 text-emerald-200 bg-slate-950/95 shadow-[0_0_20px_rgba(52,211,153,0.3)]';
    }

    this.abilityFeedbackRoot.innerHTML = `
      <div class="border rounded-xl px-5 py-2.5 font-mono text-xs font-bold tracking-wider animate-in fade-in zoom-in-95 duration-150 ${colorClasses}">
        ${fb.message}
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
