import { CoreController } from '../gameplay/CoreController';
import { AlienAI, AlienState } from '../gameplay/AlienAI';
import { AbilitySystem } from '../gameplay/AbilitySystem';
import { SpecialistManager } from '../gameplay/SpecialistManager';
import { GameEventFeed } from './GameEventFeed';

export class HUDManager {
  private container: HTMLElement;
  private coreCtrl: CoreController;
  private alienAI: AlienAI;
  private abilitySys: AbilitySystem;
  private specialistMgr: SpecialistManager;

  // DOM Elements
  private humanScoreEl!: HTMLElement;
  private alienScoreEl!: HTMLElement;
  private humanSegments: HTMLElement[] = [];
  private alienSegments: HTMLElement[] = [];
  private missionTimerEl!: HTMLElement;
  private specialistsBadgeEl!: HTMLElement;
  private extractPromptEl!: HTMLElement;
  private extractRingFill!: SVGCircleElement;
  private extractPctText!: HTMLElement;
  private abilityCards: Record<1 | 2 | 3, HTMLElement> = {} as any;
  private abilityCooldowns: Record<1 | 2 | 3, HTMLElement> = {} as any;
  private notificationsEl!: HTMLElement;
  private reconStatusEl!: HTMLElement;
  private scanIndicatorEl!: HTMLElement;

  // Phase 16 Additions
  public eventFeed!: GameEventFeed;
  private objectiveTextEl!: HTMLElement;
  private demoBadgeEl!: HTMLElement;
  private playerIdentityEl!: HTMLElement;
  private alienExtractionBadgeEl!: HTMLElement;

  private notifications: { id: number; el: HTMLElement }[] = [];
  private nextNotifId: number = 1;
  public isDemoMode: boolean = false;
  public playerName: string = 'PLAYER';
  public playerRole: 'HUMAN' | 'ALIEN' = 'HUMAN';
  public isOnline: boolean = true;

  constructor(
    container: HTMLElement,
    coreCtrl: CoreController,
    alienAI: AlienAI,
    abilitySys: AbilitySystem,
    specialistMgr: SpecialistManager
  ) {
    this.container = container;
    this.coreCtrl = coreCtrl;
    this.alienAI = alienAI;
    this.abilitySys = abilitySys;
    this.specialistMgr = specialistMgr;

    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <!-- Top Center Bar -->
      <div class="hud-top-bar">
        <div class="hud-title-wrap">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span class="text-xs font-mono text-cyan-400 font-bold tracking-widest">LIVE RACE PROTOCOL</span>
            <span id="hud-demo-badge" class="hidden px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold tracking-wider">
              DEMO MODE
            </span>
          </div>
          <div class="text-lg font-black tracking-widest text-white glow-cyan">EARTH // SHUKA</div>
          <div id="hud-mission-timer" class="text-xs font-mono text-slate-300 tracking-wider">00:00</div>
        </div>

        <div class="hud-progress-container sci-fi-panel">
          <!-- Human Side -->
          <div class="faction-progress">
            <div class="faction-header">
              <span class="text-cyan-400 font-bold tracking-wider">HUMAN // SHUKA</span>
              <span id="human-score-text" class="text-cyan-300 font-mono font-bold">0 / 5</span>
            </div>
            <div class="progress-track" id="human-progress-track">
              <div class="progress-segment" data-idx="0"></div>
              <div class="progress-segment" data-idx="1"></div>
              <div class="progress-segment" data-idx="2"></div>
              <div class="progress-segment" data-idx="3"></div>
              <div class="progress-segment" data-idx="4"></div>
            </div>
          </div>

          <!-- Tension Divider -->
          <div class="race-tension-text hidden md:block">
            VS<br/><span class="text-[9px] text-slate-400 font-mono">EXTRACTION RACE</span>
          </div>

          <!-- Alien Side -->
          <div class="faction-progress">
            <div class="faction-header">
              <span class="text-rose-400 font-bold tracking-wider">ALIEN // EARTH</span>
              <span id="alien-score-text" class="text-rose-400 font-mono font-bold">0 / 5</span>
            </div>
            <div class="progress-track" id="alien-progress-track">
              <div class="progress-segment" data-idx="0"></div>
              <div class="progress-segment" data-idx="1"></div>
              <div class="progress-segment" data-idx="2"></div>
              <div class="progress-segment" data-idx="3"></div>
              <div class="progress-segment" data-idx="4"></div>
            </div>
          </div>
        </div>

        <!-- Live Objective Banner -->
        <div id="hud-objective-banner" class="mt-1 px-4 py-1 rounded-full bg-slate-950/80 border border-slate-700/80 backdrop-blur-md text-[11px] font-mono font-bold text-cyan-300 tracking-wider text-center shadow-lg">
          MISSION OBJECTIVE: <span id="hud-objective-text" class="text-white font-bold">COLLECT 5 SHUKA CORES</span>
        </div>
      </div>

      <!-- Contextual Alien Extraction Progress Banner -->
      <div id="hud-alien-extraction-badge" class="fixed top-24 right-4 z-30 hidden px-3.5 py-2 rounded-xl bg-rose-950/90 border border-rose-500/60 backdrop-blur-md font-mono text-xs text-rose-200 shadow-xl animate-pulse">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          <span id="alien-extraction-text" class="font-bold">ALIEN EXTRACTING: 0%</span>
        </div>
      </div>

      <!-- Scan Target Waypoint HUD -->
      <div id="hud-scan-indicator" class="scan-indicator-hud hidden">
        <span class="text-cyan-400 font-bold">SCAN TARGET ↓</span>
        <span class="text-slate-200 font-mono font-bold">[ENERGY CORE]</span>
        <span id="scan-distance-text" class="font-mono font-bold text-cyan-300">-- m</span>
      </div>

      <!-- Center Extraction Ring -->
      <div id="hud-extract-prompt" class="hud-extract-prompt opacity-0">
        <div class="extract-ring-wrap">
          <svg class="extract-ring-svg" viewBox="0 0 90 90">
            <circle class="extract-ring-bg" cx="45" cy="45" r="38" />
            <circle id="extract-ring-fill" class="extract-ring-fill" cx="45" cy="45" r="38" />
          </svg>
          <div id="extract-pct-text" class="extract-center-icon">E</div>
        </div>
        <div class="extract-prompt-badge">HOLD [E] TO EXTRACT</div>
      </div>

      <!-- Tactical Earth Recon PiP Window -->
      <div class="hud-recon-window">
        <div class="recon-header">
          <span>EARTH RECON DRONE</span>
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
        </div>
        <div class="recon-radar-display">
          <div class="recon-radar-lines"></div>
          <div class="recon-radar-sweep"></div>
          <div id="alien-radar-blip" class="alien-blip"></div>
        </div>
        <div id="recon-status-text" class="px-2 py-1 bg-black/80 text-[10px] font-mono text-rose-300 truncate">
          SEARCHING SECTOR...
        </div>
      </div>

      <!-- Event Notification Toast Feed -->
      <div id="hud-notifications" class="hud-notifications"></div>

      <!-- Bottom Left: Status, Player Identity & Specialists -->
      <div class="hud-bottom-left space-y-1.5">
        <div id="hud-player-identity" class="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md font-mono text-[11px] text-slate-200 flex items-center gap-2 shadow-md">
          <span id="hud-network-dot" class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>PLAYER: <strong id="hud-player-name" class="text-sky-300">PLAYER</strong></span>
          <span id="hud-network-status" class="text-[9px] text-slate-400 uppercase">ONLINE</span>
        </div>

        <div class="status-badge sci-fi-panel space-y-1">
          <div class="flex items-center justify-between gap-3 text-[10px] font-mono">
            <span class="text-slate-400 uppercase">Survival Resources:</span>
            <span id="hud-survival-resources" class="font-bold text-sky-300">🍖 100% | 🔋 100% | 🔩 0/5</span>
          </div>
          <div class="flex flex-col border-t border-slate-800/80 pt-1">
            <span class="text-[10px] font-mono text-slate-400 uppercase">Specialist Crew</span>
            <div id="specialists-badge-text" class="text-xs font-mono font-bold text-cyan-300">
              DEF: 2 // EXT: 3
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Right: Abilities HUD (EMP, Overcharge, Scan) -->
      <div class="hud-bottom-right">
        <!-- EMP Surge -->
        <div id="ability-card-1" class="ability-card">
          <div class="ability-hotkey">1</div>
          <div class="ability-name text-cyan-300">EMP SURGE</div>
          <div class="text-[9px] text-slate-400 font-mono">PAUSE 5s</div>
          <div id="ability-cd-1" class="cooldown-overlay hidden">0s</div>
        </div>

        <!-- Overcharge -->
        <div id="ability-card-2" class="ability-card">
          <div class="ability-hotkey">2</div>
          <div class="ability-name text-amber-400">OVERCHARGE</div>
          <div class="text-[9px] text-slate-400 font-mono">DISRUPT</div>
          <div id="ability-cd-2" class="cooldown-overlay hidden">0s</div>
        </div>

        <!-- Scan -->
        <div id="ability-card-3" class="ability-card">
          <div class="ability-hotkey">3</div>
          <div class="ability-name text-cyan-400">SCAN</div>
          <div class="text-[9px] text-slate-400 font-mono">LOCATE</div>
          <div id="ability-cd-3" class="cooldown-overlay hidden">0s</div>
        </div>
      </div>
    `;

    // Cache elements
    this.humanScoreEl = this.container.querySelector('#human-score-text')!;
    this.alienScoreEl = this.container.querySelector('#alien-score-text')!;
    this.missionTimerEl = this.container.querySelector('#hud-mission-timer')!;
    this.specialistsBadgeEl = this.container.querySelector('#specialists-badge-text')!;
    this.extractPromptEl = this.container.querySelector('#hud-extract-prompt')!;
    this.extractRingFill = this.container.querySelector('#extract-ring-fill') as SVGCircleElement;
    this.extractPctText = this.container.querySelector('#extract-pct-text')!;
    this.notificationsEl = this.container.querySelector('#hud-notifications')!;
    this.reconStatusEl = this.container.querySelector('#recon-status-text')!;
    this.scanIndicatorEl = this.container.querySelector('#hud-scan-indicator')!;
    this.objectiveTextEl = this.container.querySelector('#hud-objective-text')!;
    this.demoBadgeEl = this.container.querySelector('#hud-demo-badge')!;
    this.playerIdentityEl = this.container.querySelector('#hud-player-identity')!;
    this.alienExtractionBadgeEl = this.container.querySelector('#hud-alien-extraction-badge')!;

    this.eventFeed = new GameEventFeed(this.notificationsEl);

    for (let i = 0; i < 5; i++) {
      this.humanSegments.push(this.container.querySelector(`#human-progress-track [data-idx="${i}"]`)!);
      this.alienSegments.push(this.container.querySelector(`#alien-progress-track [data-idx="${i}"]`)!);
    }

    for (const id of [1, 2, 3] as const) {
      this.abilityCards[id] = this.container.querySelector(`#ability-card-${id}`)!;
      this.abilityCooldowns[id] = this.container.querySelector(`#ability-cd-${id}`)!;

      // Clickable for mouse or touch
      this.abilityCards[id].addEventListener('click', () => {
        this.abilitySys.activateAbility(id);
      });
    }
  }

  public update(missionTimeSeconds: number): void {
    // 1. Mission Timer
    const mins = Math.floor(missionTimeSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(missionTimeSeconds % 60).toString().padStart(2, '0');
    this.missionTimerEl.textContent = `${mins}:${secs}`;

    // 2. Score counts & segment bars
    const hScore = this.coreCtrl.shukaCoresCollected;
    const aScore = this.coreCtrl.earthCoresCollected;
    this.humanScoreEl.textContent = `${hScore} / 5`;
    this.alienScoreEl.textContent = `${aScore} / 5`;

    this.humanSegments.forEach((seg, idx) => {
      seg.className = 'progress-segment';
      if (idx < hScore) {
        seg.classList.add('active-human');
      } else if (idx === hScore && this.coreCtrl.activeExtractingCore) {
        seg.classList.add('pulse-extracting', 'bg-cyan-500/50');
      }
    });

    this.alienSegments.forEach((seg, idx) => {
      seg.className = 'progress-segment';
      if (idx < aScore) {
        seg.classList.add('active-alien');
      } else if (idx === aScore && this.alienAI.state === AlienState.EXTRACTING) {
        seg.classList.add('pulse-extracting', 'bg-rose-500/50');
      }
    });

    // 3. Extraction Indicator (Ring & Prompt)
    const nearest = this.coreCtrl.nearestCoreToPlayer;
    if (nearest && !nearest.core.isExtracted) {
      this.extractPromptEl.classList.remove('opacity-0');
      const progress = nearest.core.extractionProgress;
      const circumference = 251.2;
      const offset = circumference * (1 - progress);
      this.extractRingFill.style.strokeDashoffset = offset.toString();

      if (progress > 0) {
        this.extractPctText.textContent = `${Math.floor(progress * 100)}%`;
      } else {
        this.extractPctText.textContent = 'E';
      }
    } else {
      this.extractPromptEl.classList.add('opacity-0');
    }

    // 4. Abilities Cooldowns
    for (const id of [1, 2, 3] as const) {
      const cd = this.abilitySys.getCooldown(id);
      const card = this.abilityCards[id];
      const cdEl = this.abilityCooldowns[id];

      if (cd > 0) {
        card.classList.add('on-cooldown');
        cdEl.classList.remove('hidden');
        cdEl.textContent = `${Math.ceil(cd)}s`;
      } else {
        card.classList.remove('on-cooldown');
        cdEl.classList.add('hidden');
      }
    }

    // 8. Phase 16: Demo Mode Badge
    if (this.isDemoMode) {
      this.demoBadgeEl.classList.remove('hidden');
    } else {
      this.demoBadgeEl.classList.add('hidden');
    }

    // 9. Phase 16: Dynamic Live Objective Banner
    if (hScore >= 4) {
      this.objectiveTextEl.innerHTML = '<span class="text-amber-300 font-black tracking-widest">FINAL CORE — ONE MORE TO WIN!</span>';
    } else if (aScore >= 4) {
      this.objectiveTextEl.innerHTML = '<span class="text-rose-400 font-black tracking-widest">WARNING: ALIEN ONE CORE FROM VICTORY!</span>';
    } else {
      const needed = Math.max(1, 5 - hScore);
      this.objectiveTextEl.textContent = `COLLECT ${needed} MORE SHUKA CORES`;
    }

    // 10. Phase 16: Contextual Alien Extraction Progress & Disruption Badge
    const alienExtText = this.container.querySelector('#alien-extraction-text');
    if (this.alienAI.state === AlienState.EXTRACTING) {
      this.alienExtractionBadgeEl.classList.remove('hidden');
      const pct = Math.floor((this.alienAI as any).extractionProgress ? (this.alienAI as any).extractionProgress * 100 : 50);
      if (alienExtText) alienExtText.textContent = `ALIEN EXTRACTING: ${pct}%`;
    } else if ((this.alienAI as any).isDisrupted) {
      this.alienExtractionBadgeEl.classList.remove('hidden');
      if (alienExtText) alienExtText.textContent = `EXTRACTION DISRUPTED!`;
    } else {
      this.alienExtractionBadgeEl.classList.add('hidden');
    }

    // 11. Phase 16: Player Identity, Faction Survival Resources & Socket Status
    const nameEl = this.container.querySelector('#hud-player-name');
    const netStatusEl = this.container.querySelector('#hud-network-status');
    const netDotEl = this.container.querySelector('#hud-network-dot');
    const survivalResEl = this.container.querySelector('#hud-survival-resources');

    if (nameEl) nameEl.textContent = `${this.playerRole}: ${this.playerName.toUpperCase()}`;
    if (netStatusEl) netStatusEl.textContent = this.isOnline ? 'ONLINE' : 'RECONNECTING...';
    if (netDotEl) {
      netDotEl.className = `w-2 h-2 rounded-full ${this.isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`;
    }

    if (survivalResEl) {
      if (this.playerRole === 'ALIEN') {
        survivalResEl.textContent = `💠 100% | ⚡ 100% | 🧬 ${aScore}/5`;
      } else {
        survivalResEl.textContent = `🍖 100% | 🔋 100% | 🔩 ${hScore}/5`;
      }
    }
  }

  public showNotification(text: string, type: 'normal' | 'danger' | 'amber' = 'normal'): void {
    const notif = document.createElement('div');
    notif.className = `notification-item ${type === 'danger' ? 'alert-danger' : type === 'amber' ? 'alert-amber' : ''}`;
    notif.textContent = text;
    this.notificationsEl.appendChild(notif);

    const id = this.nextNotifId++;
    this.notifications.push({ id, el: notif });

    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        if (notif.parentNode) notif.parentNode.removeChild(notif);
        this.notifications = this.notifications.filter(n => n.id !== id);
      }, 300);
    }, 4000);
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }
}
