import { NetworkManager } from '../network/NetworkManager';
import { AudioManager } from '../core/AudioManager';
import { ConnectionStatusUI } from './ConnectionStatusUI';
import { LoadingScreen } from './LoadingScreen';
import { MainMenu } from './MainMenu';
import { HowToPlayUI } from './HowToPlayUI';
import { SettingsUI } from './SettingsUI';
import { NotificationToast } from './NotificationToast';

export enum ScreenState {
  LOADING = 'LOADING',
  MAIN_MENU = 'MAIN_MENU',
  CREATE_MISSION = 'CREATE_MISSION',
  JOIN_MISSION = 'JOIN_MISSION',
  HOW_TO_PLAY = 'HOW_TO_PLAY',
  SETTINGS = 'SETTINGS',
  LOBBY = 'LOBBY',
  SPECIALIST_ALLOCATION = 'SPECIALIST_ALLOCATION',
  GAMEPLAY = 'GAMEPLAY',
  RESULTS = 'RESULTS'
}

export interface ScreenManagerOptions {
  menuRoot: HTMLElement;
  hudRoot: HTMLElement;
  modalRoot: HTMLElement;
  networkMgr: NetworkManager;
  audioMgr: AudioManager;
  onStartSingleplayer?: () => void;
}

export class ScreenManager {
  private menuRoot: HTMLElement;
  private hudRoot: HTMLElement;
  private modalRoot: HTMLElement;
  private networkMgr: NetworkManager;
  private audioMgr: AudioManager;

  private currentScreenState: ScreenState = ScreenState.LOADING;

  // Sub-UI instances
  public connectionStatusUI: ConnectionStatusUI | null = null;
  public loadingScreen: LoadingScreen | null = null;
  public mainMenu: MainMenu | null = null;
  public howToPlayUI: HowToPlayUI | null = null;
  public settingsUI: SettingsUI | null = null;

  constructor(options: ScreenManagerOptions) {
    this.menuRoot = options.menuRoot;
    this.hudRoot = options.hudRoot;
    this.modalRoot = options.modalRoot;
    this.networkMgr = options.networkMgr;
    this.audioMgr = options.audioMgr;

    this.init();
  }

  private init(): void {
    // Mount loading screen initially
    this.loadingScreen = new LoadingScreen(document.body);

    // Setup network event listeners for toasts and status updates
    this.setupNetworkListeners();
  }

  public setScreenState(state: ScreenState): void {
    console.log(`[ScreenManager] Transitioning screen state: ${this.currentScreenState} -> ${state}`);
    this.currentScreenState = state;

    // Reset visibility of container roots based on state
    switch (state) {
      case ScreenState.LOADING:
        this.menuRoot.classList.add('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.add('hidden');
        break;

      case ScreenState.MAIN_MENU:
      case ScreenState.CREATE_MISSION:
      case ScreenState.JOIN_MISSION:
        this.menuRoot.classList.remove('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.add('hidden');

        if (!this.mainMenu) {
          this.mountMainMenu();
        }
        if (state === ScreenState.MAIN_MENU) this.mainMenu?.setViewMode('MAIN');
        if (state === ScreenState.CREATE_MISSION) this.mainMenu?.setViewMode('CREATE');
        if (state === ScreenState.JOIN_MISSION) this.mainMenu?.setViewMode('JOIN');
        break;

      case ScreenState.HOW_TO_PLAY:
        this.menuRoot.classList.remove('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.remove('hidden');
        if (!this.howToPlayUI) {
          this.howToPlayUI = new HowToPlayUI(this.modalRoot, () => {
            this.setScreenState(ScreenState.MAIN_MENU);
          });
        }
        break;

      case ScreenState.SETTINGS:
        this.menuRoot.classList.remove('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.remove('hidden');
        if (!this.settingsUI) {
          this.settingsUI = new SettingsUI(this.modalRoot, this.audioMgr, () => {
            this.setScreenState(ScreenState.MAIN_MENU);
          });
        }
        break;

      case ScreenState.LOBBY:
      case ScreenState.SPECIALIST_ALLOCATION:
        this.menuRoot.classList.remove('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.add('hidden');
        break;

      case ScreenState.GAMEPLAY:
        this.menuRoot.classList.add('hidden');
        this.hudRoot.classList.remove('hidden');
        this.modalRoot.classList.add('hidden');
        break;

      case ScreenState.RESULTS:
        this.menuRoot.classList.add('hidden');
        this.hudRoot.classList.add('hidden');
        this.modalRoot.classList.remove('hidden');
        break;
    }
  }

  public get getScreenState(): ScreenState {
    return this.currentScreenState;
  }

  public finishLoading(): void {
    if (this.loadingScreen) {
      this.loadingScreen.hide(() => {
        this.loadingScreen = null;
        this.setScreenState(ScreenState.MAIN_MENU);
      });
    } else {
      this.setScreenState(ScreenState.MAIN_MENU);
    }
  }

  private mountMainMenu(): void {
    this.mainMenu = new MainMenu({
      container: this.menuRoot,
      networkMgr: this.networkMgr,
      audioMgr: this.audioMgr,
      onCreateRoom: async (playerName: string) => {
        const res = await this.networkMgr.createRoom(playerName);
        if (!res.success) {
          NotificationToast.show({ message: res.error || 'Failed to create room', type: 'error' });
        }
      },
      onJoinRoom: async (playerName: string, roomCode: string) => {
        const res = await this.networkMgr.joinRoom(playerName, roomCode);
        if (!res.success) {
          NotificationToast.show({ message: res.error || 'Failed to join room', type: 'error' });
        }
      },
      onOpenHowToPlay: () => {
        this.setScreenState(ScreenState.HOW_TO_PLAY);
      },
      onOpenSettings: () => {
        this.setScreenState(ScreenState.SETTINGS);
      }
    });

    // Attach connection indicator slot
    const slot = this.menuRoot.querySelector('#main-menu-connection-slot') as HTMLElement;
    if (slot) {
      this.connectionStatusUI = new ConnectionStatusUI(slot, this.networkMgr);
    }
  }

  private setupNetworkListeners(): void {
    this.networkMgr.on('ROOM_ERROR', (data: { message: string }) => {
      NotificationToast.show({ message: data.message, type: 'error' });
    });

    this.networkMgr.on('disconnect', () => {
      NotificationToast.show({ message: 'Disconnected from server. Reconnecting...', type: 'warning' });
    });

    this.networkMgr.on('connect', () => {
      if (this.currentScreenState !== ScreenState.LOADING) {
        NotificationToast.show({ message: 'Connected to server', type: 'success' });
      }
    });
  }
}
