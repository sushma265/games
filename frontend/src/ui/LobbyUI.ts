import { NetworkManager, NetworkRoom, NetworkPlayer } from '../network/NetworkManager';
import { AudioManager } from '../core/AudioManager';
import { SpecialistAllocationUI } from './SpecialistAllocationUI';
import { SpecialistAllocation } from '../types';

export type LobbyState = 'MENU' | 'ROOM' | 'COUNTDOWN' | 'SPECIALIST_ALLOCATION' | 'HIDDEN';

export class LobbyUI {
  private root: HTMLElement;
  private networkMgr: NetworkManager;
  private audioMgr: AudioManager;
  private onLaunchGame: (allocation?: SpecialistAllocation) => void;

  private state: LobbyState = 'MENU';
  private errorMessage: string | null = null;
  private copyStatusText: string = 'COPY CODE';
  private copyTimeout: any = null;
  private specialistUI: SpecialistAllocationUI | null = null;
  private isSoloMode: boolean = false;

  // Stored name in localStorage for player convenience
  private storedName: string = '';

  private onReturnToMenuCallback?: () => void;

  constructor(
    root: HTMLElement,
    networkMgr: NetworkManager,
    audioMgr: AudioManager,
    onLaunchGame: (allocation?: SpecialistAllocation) => void,
    onReturnToMenu?: () => void
  ) {
    this.root = root;
    this.networkMgr = networkMgr;
    this.audioMgr = audioMgr;
    this.onLaunchGame = onLaunchGame;
    this.onReturnToMenuCallback = onReturnToMenu;

    try {
      this.storedName = localStorage.getItem('earth_shuka_player_name') || '';
    } catch {
      this.storedName = '';
    }

    this.setupNetworkListeners();
    this.render();
  }

  private setupNetworkListeners(): void {
    this.networkMgr.on('ROOM_CREATED', () => {
      this.errorMessage = null;
      this.state = 'ROOM';
      this.audioMgr.playClick();
      this.render();
    });

    this.networkMgr.on('ROOM_JOINED', () => {
      this.errorMessage = null;
      this.state = 'ROOM';
      this.audioMgr.playClick();
      this.render();
    });

    this.networkMgr.on('ROOM_UPDATED', () => {
      if (this.state === 'ROOM') {
        this.render();
      }
    });

    this.networkMgr.on('PLAYER_JOINED', () => {
      this.audioMgr.playScanPing();
      if (this.state === 'ROOM') {
        this.render();
      }
    });

    this.networkMgr.on('PLAYER_LEFT', () => {
      if (this.state === 'ROOM') {
        this.render();
      }
    });

    this.networkMgr.on('HOST_CHANGED', (data: { newHostId: string }) => {
      if (this.specialistUI) {
        const amIHost = this.networkMgr.localPlayerId === data.newHostId;
        this.specialistUI.setHostStatus(amIHost);
      }
      if (this.state === 'ROOM') {
        this.render();
      }
    });

    this.networkMgr.on('GAME_STARTING', (data: { countdown: number }) => {
      this.state = 'COUNTDOWN';
      this.renderCountdown(data.countdown);
      this.audioMgr.playCountdownBeep(false);
    });

    this.networkMgr.on('COUNTDOWN_TICK', (data: { count: number | string }) => {
      this.state = 'COUNTDOWN';
      this.renderCountdown(data.count);
      const isGo = data.count === 'GO';
      this.audioMgr.playCountdownBeep(isGo);
    });

    this.networkMgr.on('SPECIALIST_ALLOCATION_PHASE', () => {
      this.state = 'SPECIALIST_ALLOCATION';
      this.render();
    });

    this.networkMgr.on('COUNTDOWN_CANCELLED', (data: { reason: string }) => {
      if (this.specialistUI) {
        this.specialistUI.destroy();
        this.specialistUI = null;
      }
      this.state = 'ROOM';
      this.errorMessage = data.reason;
      this.render();
    });

    this.networkMgr.on('GAME_STARTED', (data: any) => {
      if (this.specialistUI) {
        this.specialistUI.destroy();
        this.specialistUI = null;
      }
      this.hide();
      this.onLaunchGame(data?.specialists || this.networkMgr.specialists);
    });

    this.networkMgr.on('ROOM_ERROR', (data: { message: string }) => {
      this.errorMessage = data.message;
      this.render();
    });

    this.networkMgr.on('ROOM_LEFT', () => {
      if (this.specialistUI) {
        this.specialistUI.destroy();
        this.specialistUI = null;
      }
      this.state = 'MENU';
      this.errorMessage = null;
      if (this.onReturnToMenuCallback) {
        this.onReturnToMenuCallback();
      } else {
        this.render();
      }
    });
  }

  public show(): void {
    this.root.classList.remove('hidden');
    this.render();
  }

  public hide(): void {
    if (this.specialistUI) {
      this.specialistUI.destroy();
      this.specialistUI = null;
    }
    this.state = 'HIDDEN';
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  public render(): void {
    if (this.state === 'HIDDEN') {
      this.root.classList.add('hidden');
      return;
    }

    this.root.classList.remove('hidden');

    if (this.state === 'MENU') {
      this.renderCreateJoinMenu();
    } else if (this.state === 'ROOM') {
      this.renderRoomLobby();
    } else if (this.state === 'SPECIALIST_ALLOCATION') {
      this.renderSpecialistAllocation();
    }
  }

  private renderSpecialistAllocation(): void {
    if (this.specialistUI) {
      this.specialistUI.destroy();
      this.specialistUI = null;
    }
    this.root.innerHTML = '';
    this.specialistUI = new SpecialistAllocationUI({
      container: this.root,
      networkMgr: this.networkMgr,
      audioMgr: this.audioMgr,
      isHost: this.isSoloMode ? true : this.networkMgr.isHost,
      isSolo: this.isSoloMode,
      onConfirmed: (allocation: SpecialistAllocation) => {
        this.specialistUI?.destroy();
        this.specialistUI = null;
        this.hide();
        this.onLaunchGame(allocation);
      }
    });
  }

  /**
   * Screen 1: Dark Sci-Fi Main Lobby (Create Mission / Join Mission)
   */
  private renderCreateJoinMenu(): void {
    const errorHtml = this.errorMessage
      ? `<div class="lobby-alert-banner">${this.escapeHtml(this.errorMessage)}</div>`
      : '';

    this.root.innerHTML = `
      <div class="lobby-overlay">
        <div class="lobby-container">
          <!-- Header -->
          <div class="lobby-header">
            <div class="text-xs font-mono text-cyan-400 tracking-[0.35em] uppercase">
              TACTICAL NETWORK // MULTIPLAYER PROTOCOL
            </div>
            <h1 class="lobby-title">EARTH // SHUKA</h1>
            <p class="lobby-subtitle glow-cyan">TWO WORLDS. ONE RACE FOR SURVIVAL.</p>
          </div>

          ${errorHtml}

          <!-- Create / Join Grid -->
          <div class="lobby-main-grid">
            <!-- CREATE MISSION CARD -->
            <div class="lobby-card">
              <div class="lobby-card-title">
                <span class="w-2.5 h-2.5 bg-cyan-400 inline-block"></span>
                CREATE MISSION
              </div>
              <p class="text-xs text-slate-400 font-mono leading-relaxed">
                Host a new secure operational lobby and invite up to 3 other operatives with a unique mission code.
              </p>

              <div class="lobby-field">
                <label class="lobby-label" for="create-name-input">PLAYER NAME</label>
                <input
                  id="create-name-input"
                  class="lobby-input"
                  type="text"
                  maxlength="16"
                  placeholder="Commander"
                  value="${this.escapeHtml(this.storedName)}"
                  autocomplete="off"
                />
              </div>

              <button id="btn-create-room" class="sci-fi-btn w-full mt-2 py-3 text-sm">
                CREATE ROOM
              </button>
            </div>

            <!-- JOIN MISSION CARD -->
            <div class="lobby-card">
              <div class="lobby-card-title">
                <span class="w-2.5 h-2.5 bg-purple-400 inline-block"></span>
                JOIN MISSION
              </div>
              <p class="text-xs text-slate-400 font-mono leading-relaxed">
                Enter an active mission code to infiltrate an existing session and coordinate core extraction.
              </p>

              <div class="lobby-field">
                <label class="lobby-label" for="join-name-input">PLAYER NAME</label>
                <input
                  id="join-name-input"
                  class="lobby-input"
                  type="text"
                  maxlength="16"
                  placeholder="Operative"
                  value="${this.escapeHtml(this.storedName)}"
                  autocomplete="off"
                />
              </div>

              <div class="lobby-field">
                <label class="lobby-label" for="join-code-input">ROOM CODE</label>
                <input
                  id="join-code-input"
                  class="lobby-input uppercase tracking-widest text-cyan-300 font-bold"
                  type="text"
                  maxlength="6"
                  placeholder="AB7K92"
                  autocomplete="off"
                />
              </div>

              <button id="btn-join-room" class="sci-fi-btn sci-fi-btn-amber w-full mt-2 py-3 text-sm">
                JOIN ROOM
              </button>
            </div>
          </div>

          <!-- Solo Simulation & Protocol Specs Footer -->
          <div class="mt-4 flex flex-col sm:flex-row items-center justify-between w-full border-t border-cyan-500/20 pt-4 text-xs font-mono text-slate-400 gap-4">
            <div class="flex items-center gap-3">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>NODE // SOCKET.IO ACTIVE</span>
              <span>•</span>
              <span>MAX 4 OPERATIVES</span>
            </div>

            <button id="btn-solo-simulation" class="text-xs text-cyan-400/80 hover:text-cyan-300 font-mono underline hover:no-underline cursor-pointer transition-colors">
              [ SOLO RECON PROTOCOL ]
            </button>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    const createNameInput = this.root.querySelector('#create-name-input') as HTMLInputElement;
    const joinNameInput = this.root.querySelector('#join-name-input') as HTMLInputElement;
    const joinCodeInput = this.root.querySelector('#join-code-input') as HTMLInputElement;

    // Synchronize name inputs
    createNameInput?.addEventListener('input', () => {
      if (joinNameInput) joinNameInput.value = createNameInput.value;
      this.storedName = createNameInput.value.trim();
    });
    joinNameInput?.addEventListener('input', () => {
      if (createNameInput) createNameInput.value = joinNameInput.value;
      this.storedName = joinNameInput.value.trim();
    });

    // Auto-uppercase room code
    joinCodeInput?.addEventListener('input', () => {
      joinCodeInput.value = joinCodeInput.value.toUpperCase();
    });

    // Enter key shortcuts
    createNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.triggerCreateRoom(createNameInput.value);
    });
    joinCodeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.triggerJoinRoom(joinNameInput.value, joinCodeInput.value);
    });

    this.root.querySelector('#btn-create-room')?.addEventListener('click', () => {
      this.triggerCreateRoom(createNameInput?.value || '');
    });

    this.root.querySelector('#btn-join-room')?.addEventListener('click', () => {
      this.triggerJoinRoom(joinNameInput?.value || '', joinCodeInput?.value || '');
    });

    this.root.querySelector('#btn-solo-simulation')?.addEventListener('click', () => {
      this.audioMgr.playClick();
      this.isSoloMode = true;
      this.state = 'SPECIALIST_ALLOCATION';
      this.render();
    });
  }

  private async triggerCreateRoom(name: string): Promise<void> {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      this.errorMessage = 'ENTER YOUR NAME (2-16 characters)';
      this.render();
      return;
    }
    this.saveName(trimmed);
    this.audioMgr.playClick();
    const res = await this.networkMgr.createRoom(trimmed);
    if (!res.success) {
      this.errorMessage = res.error || 'Failed to create room';
      this.render();
    }
  }

  private async triggerJoinRoom(name: string, code: string): Promise<void> {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 16) {
      this.errorMessage = 'ENTER YOUR NAME (2-16 characters)';
      this.render();
      return;
    }
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      this.errorMessage = 'ENTER ROOM CODE';
      this.render();
      return;
    }
    this.saveName(trimmedName);
    this.audioMgr.playClick();
    const res = await this.networkMgr.joinRoom(trimmedName, trimmedCode);
    if (!res.success) {
      this.errorMessage = res.error || 'Failed to join room';
      this.render();
    }
  }

  private saveName(name: string): void {
    this.storedName = name;
    try {
      localStorage.setItem('earth_shuka_player_name', name);
    } catch {
      // Ignore
    }
  }

  /**
   * Screen 2: Active Mission Room Lobby
   */
  private renderRoomLobby(): void {
    const room = this.networkMgr.currentRoom;
    if (!room) {
      this.state = 'MENU';
      this.render();
      return;
    }

    const localPlayer = this.networkMgr.localPlayer;
    const isHost = this.networkMgr.isHost;
    const playerCount = room.players.length;
    const maxPlayers = room.maxPlayers || 4;

    // Check ready conditions:
    // At least 2 players, and all players ready
    const allReady = room.players.every((p) => p.ready);
    const canStart = isHost && playerCount >= 2 && allReady;

    const errorHtml = this.errorMessage
      ? `<div class="lobby-alert-banner">${this.escapeHtml(this.errorMessage)}</div>`
      : '';

    // Render 4 player slots
    let slotsHtml = '';
    for (let i = 0; i < maxPlayers; i++) {
      if (i < room.players.length) {
        const p = room.players[i];
        const isLocal = p.id === this.networkMgr.localPlayerId;
        const isPlayerHost = p.isHost;
        const isPlayerReady = p.ready;

        const dotClass = isPlayerHost
          ? 'host'
          : isPlayerReady
          ? 'ready'
          : 'not-ready';

        const statusBadge = isPlayerHost
          ? `<span class="badge-host">HOST</span>`
          : isPlayerReady
          ? `<span class="badge-ready">READY</span>`
          : `<span class="badge-not-ready">NOT READY</span>`;

        const youBadge = isLocal ? `<span class="badge-you">(YOU)</span>` : '';

        slotsHtml += `
          <div class="lobby-player-row ${isLocal ? 'is-local' : ''}">
            <div class="lobby-player-info">
              <span class="player-status-dot ${dotClass}"></span>
              <span class="player-name-text">${this.escapeHtml(p.name)}</span>
              ${youBadge}
            </div>
            <div class="player-badges">
              ${statusBadge}
            </div>
          </div>
        `;
      } else {
        // Empty slot
        slotsHtml += `
          <div class="lobby-player-row empty-slot">
            <div class="lobby-player-info">
              <span class="player-status-dot not-ready opacity-40"></span>
              <span class="text-sm font-mono text-slate-500">Waiting for operative...</span>
            </div>
            <span class="text-xs font-mono text-slate-600">SLOT ${i + 1}</span>
          </div>
        `;
      }
    }

    // Host Start Button state text
    let hostStartBtnHtml = '';
    if (isHost) {
      if (canStart) {
        hostStartBtnHtml = `
          <button id="btn-start-mission" class="sci-fi-btn w-full py-3.5 text-base glow-cyan">
            START MISSION
          </button>
        `;
      } else if (playerCount < 2) {
        hostStartBtnHtml = `
          <button id="btn-start-mission" disabled class="sci-fi-btn w-full py-3 text-xs opacity-50 cursor-not-allowed">
            WAITING FOR PLAYERS (2-4 REQUIRED)
          </button>
        `;
      } else {
        hostStartBtnHtml = `
          <button id="btn-start-mission" disabled class="sci-fi-btn w-full py-3 text-xs opacity-50 cursor-not-allowed">
            WAITING FOR ALL OPERATIVES TO BE READY
          </button>
        `;
      }
    } else {
      hostStartBtnHtml = `
        <div class="w-full py-3 px-4 text-center text-xs font-mono tracking-widest text-slate-400 bg-slate-900/50 border border-slate-700/50">
          WAITING FOR HOST TO LAUNCH MISSION
        </div>
      `;
    }

    // Ready toggle button for players
    const isCurrentReady = localPlayer?.ready ?? false;
    const readyBtnLabel = isCurrentReady ? 'NOT READY' : 'READY';
    const readyBtnClass = isCurrentReady
      ? 'sci-fi-btn sci-fi-btn-amber'
      : 'sci-fi-btn';

    this.root.innerHTML = `
      <div class="lobby-overlay">
        <div class="lobby-room-view">
          <!-- Room Title -->
          <div class="flex items-center justify-between border-b border-cyan-500/30 pb-3">
            <div>
              <div class="text-xs font-mono text-cyan-400 tracking-widest">EARTH // SHUKA</div>
              <h2 class="text-lg font-bold font-display text-white tracking-wide">MISSION ROOM</h2>
            </div>
            <div class="text-xs font-mono text-slate-400 px-3 py-1 bg-slate-900/80 border border-slate-700">
              STATUS: <span class="text-cyan-400 font-bold">${room.status}</span>
            </div>
          </div>

          ${errorHtml}

          <!-- Mission Code Display Box -->
          <div class="lobby-code-box">
            <div class="text-xs font-mono text-slate-400 tracking-widest uppercase">
              SHARE THIS MISSION CODE
            </div>
            <div class="lobby-code-val">${room.code}</div>
            <button id="btn-copy-code" class="copy-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>${this.copyStatusText}</span>
            </button>
          </div>

          <!-- Operatives List -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-slate-400 tracking-wider">OPERATIVES LIST</span>
              <span class="text-xs font-mono text-cyan-400 font-bold">${playerCount} / ${maxPlayers} PLAYERS</span>
            </div>
            <div class="lobby-player-list">
              ${slotsHtml}
            </div>
          </div>

          <!-- Controls Button Group -->
          <div class="flex flex-col gap-3 pt-2">
            <!-- Ready Button (Always available for all connected players) -->
            <button id="btn-toggle-ready" class="${readyBtnClass} w-full py-2.5 text-sm">
              ${readyBtnLabel}
            </button>

            <!-- Host Start / Waiting Banner -->
            ${hostStartBtnHtml}

            <!-- Leave Room Button -->
            <button id="btn-leave-room" class="sci-fi-btn sci-fi-btn-danger w-full py-2 text-xs">
              LEAVE ROOM
            </button>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    this.root.querySelector('#btn-copy-code')?.addEventListener('click', () => {
      this.copyRoomCode(room.code);
    });

    this.root.querySelector('#btn-toggle-ready')?.addEventListener('click', async () => {
      this.audioMgr.playClick();
      const current = this.networkMgr.localPlayer?.ready ?? false;
      await this.networkMgr.setReady(!current);
    });

    this.root.querySelector('#btn-start-mission')?.addEventListener('click', async () => {
      if (!canStart) return;
      this.audioMgr.playClick();
      const res = await this.networkMgr.startGame();
      if (!res.success) {
        this.errorMessage = res.error || 'Failed to start game';
        this.render();
      }
    });

    this.root.querySelector('#btn-leave-room')?.addEventListener('click', async () => {
      this.audioMgr.playClick();
      await this.networkMgr.leaveRoom();
    });
  }

  /**
   * Screen 3: Synchronized 3-2-1-GO Countdown
   */
  private renderCountdown(count: number | string): void {
    this.root.innerHTML = `
      <div class="countdown-screen">
        <div class="countdown-title">MISSION STARTING</div>
        <div class="countdown-big-val glow-cyan" key="${count}">
          ${count}
        </div>
        <div class="mt-8 text-xs font-mono text-cyan-400 tracking-[0.3em] uppercase animate-pulse">
          SYNCHRONIZING OPERATIVES // PLANET SHUKA
        </div>
      </div>
    `;
  }

  private copyRoomCode(code: string): void {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          this.setCopiedFeedback();
        }).catch(() => {
          this.fallbackCopy(code);
        });
      } else {
        this.fallbackCopy(code);
      }
    } catch {
      this.fallbackCopy(code);
    }
  }

  private fallbackCopy(code: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setCopiedFeedback();
    } catch {
      this.copyStatusText = 'CODE: ' + code;
      this.render();
    }
  }

  private setCopiedFeedback(): void {
    this.copyStatusText = 'COPIED TO CLIPBOARD!';
    this.audioMgr.playClick();
    this.render();
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      this.copyStatusText = 'COPY CODE';
      if (this.state === 'ROOM') this.render();
    }, 2000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
