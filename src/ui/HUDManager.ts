import { CoreController } from '../gameplay/CoreController';
import { AlienAI, AlienState } from '../gameplay/AlienAI';
import { AbilitySystem } from '../gameplay/AbilitySystem';
import { SpecialistManager } from '../gameplay/SpecialistManager';

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

  private notifications: { id: number; el: HTMLElement }[] = [];
  private nextNotifId: number = 1;

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
      </div>

      <!-- Scan Target Waypoint HUD -->
      <div id="hud-scan-indicator" class="scan-indicator-hud hidden">
        <span class="text-cyan-400">◎ SCAN:</span>
        <span id="scan-distance-text" class="font-mono font-bold">-- m</span>
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

      <!-- Bottom Left: Status & Specialists -->
      <div class="hud-bottom-left">
        <div class="status-badge sci-fi-panel">
          <div class="flex flex-col">
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

    // 5. Specialist Badge
    this.specialistsBadgeEl.textContent = `DEF: ${this.specialistMgr.earthDefense} // EXT: ${this.specialistMgr.shukaExtraction}`;

    // 6. Tactical Recon Drone Telemetry
    this.reconStatusEl.textContent = this.alienAI.telemetryText;

    // 7. Scan Waypoint
    if (this.coreCtrl.isScanActive && this.coreCtrl.scanTargetCore) {
      this.scanIndicatorEl.classList.remove('hidden');
      const distEl = this.scanIndicatorEl.querySelector('#scan-distance-text');
      if (distEl) {
        distEl.textContent = `${Math.round(this.coreCtrl.scanTargetDistance)}m`;
      }
    } else {
      this.scanIndicatorEl.classList.add('hidden');
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
