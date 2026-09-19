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
}

export class MainMenu {
  private container: HTMLElement;
  private networkMgr: NetworkManager;
  private audioMgr: AudioManager;
  private onCreateRoomCb: (playerName: string) => Promise<void>;
  private onJoinRoomCb: (playerName: string, roomCode: string) => Promise<void>;
  private onOpenHowToPlayCb: () => void;
  private onOpenSettingsCb: () => void;

  private viewMode: MainMenuViewMode = 'MAIN';
  private storedName: string = '';
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

    this.loadPlayerName();
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
      <div class="menu-light-overlay absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-800 overflow-y-auto">
        
        <!-- Header title & tagline -->
        <div class="text-center space-y-2 mb-8 max-w-lg w-full">
          <div class="text-xs font-mono font-bold text-sky-600 tracking-[0.3em] uppercase">
            TACTICAL MULTIPLAYER SURVIVAL
          </div>
          <h1 class="text-4xl sm:text-5xl font-black font-display tracking-widest text-slate-900 drop-shadow-sm">
            EARTH // SHUKA
          </h1>
          <p class="text-xs sm:text-sm font-semibold text-slate-500 tracking-[0.2em] uppercase">
            Two Worlds. One Race for Survival.
          </p>
        </div>

        <!-- Main Card Container -->
        <div class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-6 transition-all duration-200">
          
          ${this.renderCardContent()}

        </div>

        <!-- Connection Indicator at footer -->
        <div id="main-menu-connection-slot" class="mt-6"></div>

      </div>
    `;

    this.attachHandlers();
  }

  private renderCardContent(): string {
    if (this.viewMode === 'MAIN') {
      return `
        <!-- Main Hub Buttons -->
        <div class="flex flex-col gap-3">
          <button id="btn-menu-create" class="w-full py-4 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold font-display text-sm tracking-wider uppercase rounded-xl transition-all duration-150 shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            CREATE MISSION
          </button>

          <button id="btn-menu-join" class="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-display text-sm tracking-wider uppercase rounded-xl border border-slate-300 transition-all duration-150 shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer">
            JOIN MISSION
          </button>

          <button id="btn-menu-htp" class="w-full py-3 px-6 bg-white hover:bg-slate-50 text-slate-700 font-bold font-display text-xs tracking-wider uppercase rounded-xl border border-slate-200 transition-all duration-150 shadow-sm cursor-pointer">
            HOW TO PLAY
          </button>

          <button id="btn-menu-settings" class="w-full py-3 px-6 bg-white hover:bg-slate-50 text-slate-700 font-bold font-display text-xs tracking-wider uppercase rounded-xl border border-slate-200 transition-all duration-150 shadow-sm cursor-pointer">
            SETTINGS
          </button>

          <button id="btn-menu-demo" class="w-full py-2.5 px-6 bg-slate-50 hover:bg-slate-100 text-sky-700 font-bold font-mono text-xs tracking-wider uppercase rounded-xl border border-sky-200 transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer">
            <span>⚡</span> QUICK DEMO MODE
          </button>
        </div>
      `;
    }

    if (this.viewMode === 'CREATE') {
      return `
        <!-- Create Mission View -->
        <div class="space-y-4">
          <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <div class="text-[11px] font-mono font-bold text-sky-600 tracking-wider">NEW MULTIPLAYER SESSION</div>
              <h2 class="text-xl font-bold font-display text-slate-900">CREATE MISSION</h2>
            </div>
            <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          </div>

          <div class="space-y-2">
            <label for="create-player-name" class="block text-xs font-mono font-bold text-slate-700 uppercase">
              PLAYER NAME
            </label>
            <input 
              id="create-player-name" 
              type="text" 
              maxlength="16"
              placeholder="Enter your name" 
              value="${this.escapeHtml(this.storedName)}"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              autocomplete="off"
            />
            <p class="text-[11px] font-mono text-slate-400">Max 16 characters. Stored locally.</p>
          </div>

          <div class="flex gap-3 pt-2">
            <button id="btn-form-back" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors cursor-pointer">
              BACK
            </button>
            <button 
              id="btn-form-create-submit" 
              class="flex-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold font-display text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
        <div class="space-y-4">
          <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <div class="text-[11px] font-mono font-bold text-sky-600 tracking-wider">ENTER ACTIVE ROOM</div>
              <h2 class="text-xl font-bold font-display text-slate-900">JOIN MISSION</h2>
            </div>
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1">
              <label for="join-player-name" class="block text-xs font-mono font-bold text-slate-700 uppercase">
                PLAYER NAME
              </label>
              <input 
                id="join-player-name" 
                type="text" 
                maxlength="16"
                placeholder="Enter your name" 
                value="${this.escapeHtml(this.storedName)}"
                class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                autocomplete="off"
              />
            </div>

            <div class="space-y-1">
              <label for="join-room-code" class="block text-xs font-mono font-bold text-slate-700 uppercase">
                ROOM CODE
              </label>
              <input 
                id="join-room-code" 
                type="text" 
                maxlength="6"
                placeholder="ABC123" 
                value="${this.escapeHtml(this.roomCodeInputVal)}"
                class="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sky-700 font-mono font-bold tracking-widest text-lg uppercase focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                autocomplete="off"
              />
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button id="btn-form-back" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors cursor-pointer">
              BACK
            </button>
            <button 
              id="btn-form-join-submit" 
              class="flex-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold font-display text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
        if ((window as any).debugGame && (window as any).debugGame.startSingleplayer) {
          (window as any).debugGame.startSingleplayer();
        }
      });
    } else {
      this.container.querySelector('#btn-form-back')?.addEventListener('click', () => {
        this.audioMgr.playClick();
        this.setViewMode('MAIN');
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
          } finally {
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
          } finally {
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
