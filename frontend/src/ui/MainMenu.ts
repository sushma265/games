import { NetworkManager } from '../network/NetworkManager';
import { AudioManager } from '../core/AudioManager';
import { NotificationToast } from './NotificationToast';

export type MainMenuViewMode = 'MAIN' | 'CREATE' | 'JOIN';

export interface MainMenuOptions {
  container: HTMLElement;
  networkMgr: NetworkManager;
  audioMgr: AudioManager;
  onCreateRoom: (playerName: string) => Promise<void>;
  onJoinRoom: (playerName: string, roomCode: string) => Promise<void>;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onQuickDemo?: () => void;
  onOpenGameInfo?: () => void;
}

export class MainMenu {
  private container: HTMLElement;
  private networkMgr: NetworkManager;
  private audioMgr: AudioManager;
  private onCreateRoomCb: (playerName: string) => Promise<void>;
  private onJoinRoomCb: (playerName: string, roomCode: string) => Promise<void>;
  private onOpenHowToPlayCb: () => void;
  private onOpenSettingsCb: () => void;
  private onQuickDemoCb?: () => void;
  private onOpenGameInfoCb?: () => void;

  private viewMode: MainMenuViewMode = 'MAIN';
  private storedName: string = '';
  public storedRole: 'HUMAN' | 'ALIEN' = 'HUMAN';
  private roomCodeInputVal: string = '';
  private isSubmitting: boolean = false;

  constructor(options: MainMenuOptions) {
    this.container = options.container;
    this.networkMgr = options.networkMgr;
    this.audioMgr = options.audioMgr;
    this.onCreateRoomCb = options.onCreateRoom;
    this.onJoinRoomCb = options.onJoinRoom;
    this.onOpenHowToPlayCb = options.onOpenHowToPlay;
    this.onOpenSettingsCb = options.onOpenSettings;
    this.onQuickDemoCb = options.onQuickDemo;
    this.onOpenGameInfoCb = options.onOpenGameInfo;

    this.loadPlayerName();
    this.loadPlayerRole();
    this.render();
  }

  public setViewMode(mode: MainMenuViewMode): void {
    this.viewMode = mode;
    this.render();
  }

  public get getViewMode(): MainMenuViewMode {
    return this.viewMode;
  }

  private loadPlayerName(): string {
    try {
      this.storedName = localStorage.getItem('earth_shuka_player_name') || localStorage.getItem('playerName') || '';
    } catch {
      this.storedName = '';
    }
    return this.storedName;
  }

  private loadPlayerRole(): 'HUMAN' | 'ALIEN' {
    try {
      const r = localStorage.getItem('earth_shuka_player_role');
      if (r === 'ALIEN') this.storedRole = 'ALIEN';
      else this.storedRole = 'HUMAN';
    } catch {
      this.storedRole = 'HUMAN';
    }
    return this.storedRole;
  }

  private savePlayerRole(role: 'HUMAN' | 'ALIEN'): void {
    this.storedRole = role;
    try {
      localStorage.setItem('earth_shuka_player_role', role);
    } catch {
      // safe fallback
    }
  }

  private savePlayerName(name: string): void {
    this.storedName = name.trim();
    try {
      localStorage.setItem('earth_shuka_player_name', this.storedName);
      localStorage.setItem('playerName', this.storedName);
    } catch {
      // safe fallback
    }
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="menu-light-overlay absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#f4f8fb] text-[#10212b] overflow-y-auto">
        
        <div class="menu-launcher-container w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center z-10">
          
          <!-- LEFT BRANDING -->
          <div class="menu-left-brand space-y-3 text-left">
            <div class="menu-title-label font-mono text-xs font-bold text-[#08a9c7] tracking-[0.3em] uppercase">
              TACTICAL MULTIPLAYER SURVIVAL
            </div>
            <h1 class="menu-title-main text-5xl lg:text-6xl font-black font-display tracking-wider text-[#10212b]">
              EARTH // SHUKA
            </h1>
            <p class="menu-tagline font-mono text-xs lg:text-sm font-bold text-[#5d707a] tracking-[0.25em] uppercase">
              TWO WORLDS. ONE RACE FOR SURVIVAL.
            </p>
          </div>

          <!-- RIGHT / CENTER LAUNCHER CARD -->
          <div class="menu-card-container game-card bg-white border border-[#d7e3e8] rounded-2xl p-6 sm:p-8 w-full shadow-md space-y-6">
            ${this.renderCardContent()}
          </div>

        </div>

        <!-- FOOTER INFO BAR -->
        <div class="menu-footer-bar absolute bottom-4 left-8 right-8 flex justify-between items-center font-mono text-xs text-[#8a9aa3]">
          <div id="main-menu-connection-slot"></div>
          <div>VERSION 1.0.0</div>
        </div>

      </div>
    `;

    this.attachHandlers();
  }

  private renderCardContent(): string {
    if (this.viewMode === 'MAIN') {
      return `
        <!-- Main Hub Buttons -->
        <div class="flex flex-col gap-3.5">
          <button id="btn-menu-create" class="btn-primary w-full py-4 px-6 bg-[#08a9c7] hover:bg-[#0789a3] text-[#10212b] hover:text-white font-bold font-display text-sm tracking-widest uppercase rounded-xl shadow-sm transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer">
            CREATE MISSION
          </button>

          <button id="btn-menu-join" class="btn-secondary w-full py-3.5 px-6 bg-white hover:bg-[#edf5f8] text-[#10212b] font-bold font-display text-xs tracking-widest uppercase rounded-xl border border-[#d7e3e8] shadow-sm transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer">
            JOIN MISSION
          </button>

          <button id="btn-menu-demo" class="btn-secondary w-full py-3.5 px-6 bg-[#edf5f8] hover:bg-[#dff7fb] text-[#0789a3] font-bold font-display text-xs tracking-widest uppercase rounded-xl border border-[#d7e3e8] shadow-sm transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer">
            QUICK DEMO
          </button>

          <div class="grid grid-cols-2 gap-3 pt-1">
            <button id="btn-menu-htp" class="btn-secondary py-3 px-3 bg-white hover:bg-[#edf5f8] text-[#5d707a] hover:text-[#10212b] font-bold font-display text-xs tracking-wider uppercase rounded-xl border border-[#d7e3e8] transition-all duration-150 shadow-sm cursor-pointer truncate">
              HOW TO PLAY
            </button>

            <button id="btn-menu-settings" class="btn-secondary py-3 px-3 bg-white hover:bg-[#edf5f8] text-[#5d707a] hover:text-[#10212b] font-bold font-display text-xs tracking-wider uppercase rounded-xl border border-[#d7e3e8] transition-all duration-150 shadow-sm cursor-pointer truncate">
              SETTINGS
            </button>
          </div>

          <button id="btn-menu-info" class="w-full py-2.5 px-4 bg-transparent hover:bg-[#edf5f8] text-[#5d707a] hover:text-[#10212b] font-bold font-mono text-[11px] tracking-wider uppercase rounded-xl border border-transparent hover:border-[#d7e3e8] transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer">
            GAME INFO & TECH STACK
          </button>
        </div>
      `;
    }

    if (this.viewMode === 'CREATE') {
      return `
        <!-- Create Mission View -->
        <div class="space-y-5">
          <div class="border-b border-[#d7e3e8] pb-3 flex justify-between items-center">
            <div>
              <div class="text-[11px] font-mono font-bold text-[#08a9c7] tracking-wider uppercase">NEW MULTIPLAYER SESSION</div>
              <h2 class="text-xl font-bold font-display text-[#10212b] uppercase">CREATE MISSION</h2>
            </div>
            <span class="w-2.5 h-2.5 rounded-full bg-[#08a9c7]"></span>
          </div>

          <div class="space-y-2">
            <label for="create-player-name" class="block text-xs font-mono font-bold text-[#5d707a] uppercase tracking-wider">
              PLAYER NAME
            </label>
            <input 
              id="create-player-name" 
              type="text" 
              maxlength="16"
              placeholder="Enter your name" 
              value="${this.escapeHtml(this.storedName)}"
              class="game-input w-full px-4 py-3 bg-[#edf5f8] border border-[#d7e3e8] rounded-xl text-[#10212b] font-mono text-sm focus:outline-none focus:border-[#08a9c7] focus:bg-white transition-colors"
              autocomplete="off"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-xs font-mono font-bold text-[#5d707a] uppercase tracking-wider">
              SELECT FACTION & MAP
            </label>
            <div class="grid grid-cols-2 gap-3 font-mono text-xs">
              <button 
                id="btn-role-human" 
                type="button" 
                class="py-3 px-3 rounded-xl border text-center font-bold transition-all duration-200 cursor-pointer ${
                  this.storedRole === 'HUMAN' 
                    ? 'bg-[#08a9c7] border-[#0789a3] text-[#10212b] shadow-sm' 
                    : 'bg-[#edf5f8] border-[#d7e3e8] text-[#5d707a] hover:bg-[#dff7fb] hover:text-[#10212b]'
                }"
              >
                HUMAN<br/><span class="text-[10px] font-normal opacity-80">(Planet Shuka)</span>
              </button>
              <button 
                id="btn-role-alien" 
                type="button" 
                class="py-3 px-3 rounded-xl border text-center font-bold transition-all duration-200 cursor-pointer ${
                  this.storedRole === 'ALIEN' 
                    ? 'bg-[#16a34a] border-[#15803d] text-white shadow-sm' 
                    : 'bg-[#edf5f8] border-[#d7e3e8] text-[#5d707a] hover:bg-[#edf5f8] hover:text-[#10212b]'
                }"
              >
                ALIEN<br/><span class="text-[10px] font-normal opacity-80">(Planet Earth)</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-3 pt-2">
            <button id="btn-form-back" class="btn-secondary col-span-2 py-3 bg-white hover:bg-[#edf5f8] text-[#5d707a] font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-[#d7e3e8] transition-colors cursor-pointer text-center">
              BACK
            </button>
            <button 
              id="btn-form-create-submit" 
              class="btn-primary col-span-3 py-3 bg-[#08a9c7] hover:bg-[#0789a3] text-[#10212b] hover:text-white font-bold font-display text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
              ${this.isSubmitting ? 'disabled' : ''}
            >
              ${this.isSubmitting ? 'CREATING...' : 'CREATE MISSION'}
            </button>
          </div>
        </div>
      `;
    }

    if (this.viewMode === 'JOIN') {
      return `
        <!-- Join Mission View -->
        <div class="space-y-5">
          <div class="border-b border-[#d7e3e8] pb-3 flex justify-between items-center">
            <div>
              <div class="text-[11px] font-mono font-bold text-[#08a9c7] tracking-wider uppercase">ENTER ACTIVE ROOM</div>
              <h2 class="text-xl font-bold font-display text-[#10212b] uppercase">JOIN MISSION</h2>
            </div>
            <span class="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1">
              <label for="join-player-name" class="block text-xs font-mono font-bold text-[#5d707a] uppercase tracking-wider">
                PLAYER NAME
              </label>
              <input 
                id="join-player-name" 
                type="text" 
                maxlength="16"
                placeholder="Enter your name" 
                value="${this.escapeHtml(this.storedName)}"
                class="game-input w-full px-4 py-2.5 bg-[#edf5f8] border border-[#d7e3e8] rounded-xl text-[#10212b] font-mono text-sm focus:outline-none focus:border-[#08a9c7] focus:bg-white transition-colors"
                autocomplete="off"
              />
            </div>

            <div class="space-y-1">
              <label for="join-room-code" class="block text-xs font-mono font-bold text-[#5d707a] uppercase tracking-wider">
                ROOM CODE
              </label>
              <input 
                id="join-room-code" 
                type="text" 
                maxlength="6"
                placeholder="ABC123" 
                value="${this.escapeHtml(this.roomCodeInputVal)}"
                class="game-input w-full px-4 py-3 bg-[#edf5f8] border border-[#d7e3e8] rounded-xl text-[#08a9c7] font-mono font-bold tracking-widest text-lg uppercase focus:outline-none focus:border-[#08a9c7] focus:bg-white transition-colors text-center"
                autocomplete="off"
              />
            </div>
          </div>

          <div class="grid grid-cols-5 gap-3 pt-2">
            <button id="btn-form-back" class="btn-secondary col-span-2 py-3 bg-white hover:bg-[#edf5f8] text-[#5d707a] font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-[#d7e3e8] transition-colors cursor-pointer text-center">
              BACK
            </button>
            <button 
              id="btn-form-join-submit" 
              class="btn-primary col-span-3 py-3 bg-[#08a9c7] hover:bg-[#0789a3] text-[#10212b] hover:text-white font-bold font-display text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
              ${this.isSubmitting ? 'disabled' : ''}
            >
              ${this.isSubmitting ? 'JOINING...' : 'JOIN MISSION'}
            </button>
          </div>
        </div>
      `;
    }

    return '';
  }

  private attachHandlers(): void {
    if (this.viewMode === 'MAIN') {
      this.container.querySelector('#btn-menu-create')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.setViewMode('CREATE');
      });

      this.container.querySelector('#btn-menu-join')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.setViewMode('JOIN');
      });

      this.container.querySelector('#btn-menu-htp')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.onOpenHowToPlayCb();
      });

      this.container.querySelector('#btn-menu-settings')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.onOpenSettingsCb();
      });

      this.container.querySelector('#btn-menu-demo')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        if (this.onQuickDemoCb) {
          this.onQuickDemoCb();
        } else if ((window as any).debugGame && (window as any).debugGame.startSingleplayer) {
          (window as any).debugGame.startSingleplayer();
        }
      });

      this.container.querySelector('#btn-menu-info')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        if (this.onOpenGameInfoCb) {
          this.onOpenGameInfoCb();
        }
      });
    } else {
      this.container.querySelector('#btn-form-back')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.setViewMode('MAIN');
      });

      this.container.querySelector('#btn-role-human')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.savePlayerRole('HUMAN');
        this.render();
      });

      this.container.querySelector('#btn-role-alien')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.savePlayerRole('ALIEN');
        this.render();
      });

      if (this.viewMode === 'CREATE') {
        const nameInput = this.container.querySelector('#create-player-name') as HTMLInputElement;
        const submitBtn = this.container.querySelector('#btn-form-create-submit');

        const triggerCreate = async () => {
          if (this.isSubmitting) return;
          const name = nameInput?.value || '';
          const trimmed = name.trim();
          if (trimmed.length < 2 || trimmed.length > 16) {
            NotificationToast.show({ message: 'Enter a valid player name (2-16 characters)', type: 'warning' });
            return;
          }
          this.savePlayerName(trimmed);
          this.audioMgr.playClick();
          this.isSubmitting = true;
          this.render();
          try {
            await this.onCreateRoomCb(trimmed);
          } catch (err: any) {
            NotificationToast.show({ message: err?.message || 'Failed to create room', type: 'error' });
            this.isSubmitting = false;
            if (this.viewMode === 'CREATE') this.render();
          }
        };

        submitBtn?.addEventListener('click', triggerCreate);
        nameInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') triggerCreate();
        });
      }

      if (this.viewMode === 'JOIN') {
        const nameInput = this.container.querySelector('#join-player-name') as HTMLInputElement;
        const codeInput = this.container.querySelector('#join-room-code') as HTMLInputElement;
        const submitBtn = this.container.querySelector('#btn-form-join-submit');

        codeInput?.addEventListener('input', () => {
          codeInput.value = codeInput.value.toUpperCase();
          this.roomCodeInputVal = codeInput.value;
        });

        const triggerJoin = async () => {
          if (this.isSubmitting) return;
          const name = nameInput?.value || '';
          const code = codeInput?.value || '';
          const trimmedName = name.trim();
          const trimmedCode = code.trim().toUpperCase();

          if (trimmedName.length < 2 || trimmedName.length > 16) {
            NotificationToast.show({ message: 'Enter a valid player name (2-16 characters)', type: 'warning' });
            return;
          }
          if (!trimmedCode || trimmedCode.length < 4) {
            NotificationToast.show({ message: 'Enter a valid room code', type: 'warning' });
            return;
          }

          this.savePlayerName(trimmedName);
          this.audioMgr.playClick();
          this.isSubmitting = true;
          this.render();
          try {
            await this.onJoinRoomCb(trimmedName, trimmedCode);
          } catch (err: any) {
            NotificationToast.show({ message: err?.message || 'Failed to join room', type: 'error' });
            this.isSubmitting = false;
            if (this.viewMode === 'JOIN') this.render();
          }
        };

        submitBtn?.addEventListener('click', triggerJoin);
        codeInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') triggerJoin();
        });
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
