import * as BABYLON from 'babylonjs';
import { AudioManager } from './AudioManager';
import { InputManager } from './InputManager';
import { CameraController } from '../player/CameraController';
import { PlayerController } from '../player/PlayerController';
import { ShukaWorld } from '../worlds/ShukaWorld';
import { CoreController, CoreState, CoreCollectedPayload } from '../gameplay/CoreController';
import { CoreManager } from '../gameplay/CoreManager';
import { EarthWorld } from '../worlds/EarthWorld';
import { AlienAI } from '../gameplay/AlienAI';
import { Phase5DebugHUD } from '../ui/Phase5DebugHUD';
import { NetworkManager } from '../network/NetworkManager';
import { LobbyUI } from '../ui/LobbyUI';
import { MultiplayerManager } from '../multiplayer/MultiplayerManager';
import { SpecialistAllocation, SpecialistModifiers, SPECIALIST_CONFIG } from '../types';
import { AbilitySystem } from '../gameplay/AbilitySystem';
import { ScreenManager, ScreenState } from '../ui/ScreenManager';
import { ResultScreen } from '../ui/ResultScreen';
import { GameplayTutorialOverlay } from '../ui/GameplayTutorialOverlay';
import { GameAnnouncement } from '../ui/GameAnnouncement';
import { OnboardingOverlay } from '../ui/OnboardingOverlay';
import { GameInfoModal } from '../ui/GameInfoModal';

export enum GameState {
  MENU = 'MENU',
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  WON = 'WON',
  LOST = 'LOST'
}

export interface GameEventPayload {
  state?: GameState;
  humanCores?: number;
  alienCores?: number;
  matchTime?: number;
  remainingTime?: number;
  formattedTime?: string;
  coreId?: string;
  reason?: string;
  roomCode?: string;
  winner?: string;
  specialists?: SpecialistAllocation;
  modifiers?: SpecialistModifiers;
}

export type GameEventListener = (eventName: string, payload: GameEventPayload) => void;

/**
 * GameManager - Central Controller for EARTH // SHUKA (Phase 6):
 * - Match state machine: MENU, SETUP, COUNTDOWN, PLAYING, PAUSED, WON, LOST
 * - Match timer: configurable 300s (5:00) with countdown MM:SS format
 * - Core progress tracking: humanCores (0/5) and alienCores (0/5)
 * - Manages five Shuka Energy Cores via CoreManager
 * - Decoupled CORE_COLLECTED event handling
 * - Win condition: humanCores >= 5 -> WON
 * - Lose condition foundation: alienCores >= 5 or time expired -> LOST
 * - Clean public API: startGame, pauseGame, resumeGame, registerHumanCore, registerAlienCore, checkWinLose, resetGame
 * - Event system & temporary debug interface (window.debugGame)
 */
export class GameManager {
  public canvas: HTMLCanvasElement;
  public engine: BABYLON.Engine;
  public scene: BABYLON.Scene;

  // Subsystems
  public audioMgr: AudioManager;
  public inputMgr: InputManager;
  public cameraCtrl: CameraController;
  public playerCtrl: PlayerController;
  public shukaWorld: ShukaWorld;
  public earthWorld: EarthWorld;
  public alienAI: AlienAI;
  public isReconCameraActive: boolean = false;
  public coreManager: CoreManager;
  public abilitySys: AbilitySystem;

  // Compatibility getter for single-core references
  public get coreCtrl(): CoreController {
    return (
      this.coreManager.getActiveExtractingCore() ||
      this.coreManager.getNearestAvailableCore(this.playerCtrl.root.position) ||
      this.coreManager.cores[0]
    );
  }

  // UI Systems
  public temporaryHUD: Phase5DebugHUD;
  public lobbyUI: LobbyUI;
  public screenMgr!: ScreenManager;
  public resultScreen!: ResultScreen;

  // Multiplayer Network State (Phase 7)
  public roomCode: string | null = null;
  public localPlayerId: string | null = null;
  public isHost: boolean = false;
  public multiplayerMode: boolean = false;
  public isDemoMode: boolean = false;
  public networkMgr: NetworkManager;
  public multiplayerMgr: MultiplayerManager;

  // Game & Match State
  public state: GameState = GameState.MENU;
  public humanCores: number = 0;
  public alienCores: number = 0;
  public readonly MAX_CORES: number = 5;

  // Timer configuration
  public readonly MATCH_DURATION: number = 300; // 5 minutes in seconds
  public matchTime: number = 0; // Elapsed seconds

  // Phase 10: Specialist Allocation State
  public specialistAllocation: SpecialistAllocation = {
    total: SPECIALIST_CONFIG.totalSpecialists,
    earthDefense: SPECIALIST_CONFIG.defaultEarthDefense,
    shukaExtraction: SPECIALIST_CONFIG.defaultShukaExtraction,
    isLocked: false
  };

  public get specialistModifiers(): SpecialistModifiers {
    const edBonus = this.specialistAllocation.earthDefense * SPECIALIST_CONFIG.earthDefenseBonusPerSpecialist;
    const seBonus = this.specialistAllocation.shukaExtraction * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist;
    const finalExtTime = SPECIALIST_CONFIG.baseShukaExtractionTime / (1 + seBonus);
    return {
      earthDefenseBonus: edBonus,
      shukaExtractionBonus: seBonus,
      baseShukaExtractionTime: SPECIALIST_CONFIG.baseShukaExtractionTime,
      finalShukaExtractionTime: finalExtTime,
      earthDefense: {
        specialists: this.specialistAllocation.earthDefense,
        disruptionBonus: edBonus
      },
      shukaExtraction: {
        specialists: this.specialistAllocation.shukaExtraction,
        speedBonus: seBonus,
        duration: finalExtTime
      }
    };
  }

  // Core tracking to prevent duplicate collection counts
  public collectedCoreIds: Set<string> = new Set();

  // Internal flags
  private wasExtracting: boolean = false;
  private listeners: GameEventListener[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 1. Initialize Babylon.js Engine & Scene
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance'
    });
    this.scene = new BABYLON.Scene(this.engine);

    // 2. Initialize Core Subsystems
    this.audioMgr = new AudioManager();
    this.inputMgr = new InputManager(this.canvas);

    // 3. Create 3D Environments & Characters
    this.shukaWorld = new ShukaWorld(this.scene);
    this.earthWorld = new EarthWorld(this.scene);
    this.alienAI = new AlienAI();

    const cameraTarget = new BABYLON.TransformNode('cameraTarget', this.scene);
    this.cameraCtrl = new CameraController(this.scene, cameraTarget);
    this.playerCtrl = new PlayerController(this.scene, this.cameraCtrl, this.audioMgr);

    // Spawn player at (0, 1.2, 0)
    this.playerCtrl.root.position = new BABYLON.Vector3(0, 1.2, 0);

    // Camera target follows player
    this.scene.onBeforeRenderObservable.add(() => {
      cameraTarget.position.copyFrom(this.playerCtrl.root.position);
    });

    // 4. Create CoreManager for the Five Shuka Energy Cores
    this.coreManager = new CoreManager(
      this.scene,
      this.audioMgr,
      (payload: CoreCollectedPayload) => {
        this.handleCoreCollected(payload);
      }
    );

    // Also listen to window event for decoupled listeners
    window.addEventListener('CORE_COLLECTED', (e: Event) => {
      const detail = (e as CustomEvent).detail as CoreCollectedPayload;
      if (detail && detail.coreId && !this.collectedCoreIds.has(detail.coreId)) {
        this.handleCoreCollected(detail);
      }
    });

    // 5. Mount Network & UI Systems
    const hudRoot = document.getElementById('hud-root')!;
    const menuRoot = document.getElementById('menu-root')!;
    const modalRoot = document.getElementById('modal-root')!;
    const mobileRoot = document.getElementById('mobile-root');

    if (modalRoot) modalRoot.classList.add('hidden');
    if (mobileRoot) mobileRoot.classList.add('hidden');

    this.networkMgr = new NetworkManager();
    this.multiplayerMgr = new MultiplayerManager(this.scene, this.networkMgr, this.playerCtrl);

    this.abilitySys = new AbilitySystem(
      this.alienAI,
      this.coreManager,
      this.audioMgr,
      this.cameraCtrl,
      this.earthWorld,
      this.networkMgr,
      () => this.specialistModifiers,
      () => this.playerCtrl.root.position
    );

    this.screenMgr = new ScreenManager({
      menuRoot,
      hudRoot,
      modalRoot,
      networkMgr: this.networkMgr,
      audioMgr: this.audioMgr,
      onQuickDemo: async () => {
        this.isDemoMode = true;
        this.temporaryHUD.isDemoMode = true;
        const stored = localStorage.getItem('earth_shuka_player_name') || localStorage.getItem('playerName') || 'JUDGE DEMO';
        const res = await this.networkMgr.createRoom(stored);
        if (res.success) {
          modalRoot.classList.remove('hidden');
          new OnboardingOverlay(modalRoot, () => {
            modalRoot.classList.add('hidden');
          });
        }
      },
      onOpenGameInfo: () => {
        modalRoot.classList.remove('hidden');
        new GameInfoModal(modalRoot, () => {
          modalRoot.classList.add('hidden');
        });
      }
    });

    this.resultScreen = new ResultScreen(
      modalRoot,
      this.audioMgr,
      () => this.handleRematch(),
      () => this.handleReturnToMainMenu()
    );

    this.lobbyUI = new LobbyUI(
      menuRoot,
      this.networkMgr,
      this.audioMgr,
      (allocation?: SpecialistAllocation) => {
        if (allocation) {
          this.applySpecialistAllocation(allocation);
        }
        this.startGame();
      },
      () => {
        this.handleReturnToMainMenu();
      }
    );

    this.temporaryHUD = new Phase5DebugHUD(
      hudRoot,
      () => this.resetGame(),
      () => {
        if (this.state === GameState.PLAYING) {
          this.pauseGame();
        } else if (this.state === GameState.PAUSED) {
          this.resumeGame();
        }
      }
    );

    this.networkMgr.on('REMATCH_STARTED', () => {
      this.handleRematch(false);
    });

    this.networkMgr.on('ROOM_CREATED', () => {
      this.state = GameState.LOBBY;
      this.screenMgr.setScreenState(ScreenState.LOBBY);
    });

    this.networkMgr.on('ROOM_JOINED', () => {
      this.state = GameState.LOBBY;
      this.screenMgr.setScreenState(ScreenState.LOBBY);
    });

    // Synchronize network countdown state
    this.networkMgr.on('GAME_STARTING', () => {
      this.state = GameState.COUNTDOWN;
    });

    this.networkMgr.on('COUNTDOWN_CANCELLED', () => {
      this.state = GameState.LOBBY;
      this.screenMgr.setScreenState(ScreenState.LOBBY);
    });

    // Phase 10: Specialist Allocation synchronization
    this.networkMgr.on('SPECIALIST_ALLOCATION_PHASE', () => {
      this.state = GameState.SETUP;
      this.screenMgr.setScreenState(ScreenState.SPECIALIST_ALLOCATION);
    });

    this.networkMgr.on('SPECIALIST_ALLOCATION_CONFIRMED', (data: any) => {
      if (data.specialists) {
        this.applySpecialistAllocation(data.specialists);
      }
    });

    // Phase 9: Authoritative Alien AI & Earth Core synchronization
    this.networkMgr.on('ALIEN_UPDATED', (data: any) => {
      this.alienAI.applyServerUpdate(data);
      this.alienCores = data.collectedCores;
    });

    this.networkMgr.on('EARTH_CORE_COLLECTED', (data: { coreId: string; collectedCores: number }) => {
      this.alienAI.markCoreCollected(data.coreId);
      this.earthWorld.setCoreCollected(data.coreId, true);
      this.registerAlienCore(data.coreId);
      this.audioMgr.playAlienCoreCollected();
    });

    this.networkMgr.on('SHUKA_CORE_COLLECTED', (data: { coreId: string; humanProgress: number }) => {
      const core = this.coreManager.getCoreById(data.coreId);
      if (core && core.state !== CoreState.COLLECTED) {
        core.collect();
      }
      this.registerHumanCore(data.coreId);
    });

    this.networkMgr.on('MATCH_FINISHED', (data: { winner: 'HUMAN' | 'ALIEN'; reason?: string }) => {
      if (data.winner === 'HUMAN') {
        this.state = GameState.WON;
        this.emitEvent('GAME_WON', { humanCores: this.humanCores, alienCores: this.alienCores });
      } else {
        this.state = GameState.LOST;
        this.emitEvent('GAME_LOST', { reason: data.reason || 'ALIEN_CORES_MAX', humanCores: this.humanCores, alienCores: this.alienCores });
      }
      this.emitEvent('MATCH_FINISHED', data);
      this.showResultScreen(data.winner, data.reason || 'MATCH_FINISHED');
    });

    this.networkMgr.on('GAME_STATE_SYNC', (data: any) => {
      if (typeof data.humanProgress === 'number') this.humanCores = data.humanProgress;
      if (typeof data.alienProgress === 'number') this.alienCores = data.alienProgress;
      if (data.specialists) this.applySpecialistAllocation(data.specialists);
      if (data.alien) this.alienAI.applyServerUpdate(data.alien);
      if (data.earthCores && Array.isArray(data.earthCores)) {
        data.earthCores.forEach((c: any) => {
          if (c.collected) {
            this.alienAI.markCoreCollected(c.id);
            this.earthWorld.setCoreCollected(c.id, true);
          }
        });
      }
    });

    // Global Key Listener for Recon Cam [V] and Debug AI [F2]
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        if (this.state === GameState.PLAYING) {
          this.toggleReconCamera();
        }
      }
      if (e.key === 'F2') {
        (window as any).DEBUG_AI = !(window as any).DEBUG_AI;
      }
    });

    // 6. Expose Temporary Development Debug Interface
    this.setupDebugInterface();

    // 8. Hook Main Render Loop
    this.engine.runRenderLoop(() => {
      this.tick();
      this.scene.render();
    });

    // 9. Handle Window Resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  /**
   * Main game loop tick
   */
  private tick(): void {
    const deltaSeconds = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    // 1. Global Keyboard Short-cuts (during active match or paused)
    if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
      if (this.inputMgr.consumeReset()) {
        this.resetGame();
      }

      if (this.inputMgr.consumePause()) {
        if (this.state === GameState.PLAYING) {
          this.pauseGame();
        } else if (this.state === GameState.PAUSED) {
          this.resumeGame();
        }
      }
    }

    // 2. Active Gameplay Processing (while PLAYING)
    if (this.state === GameState.PLAYING) {
      // 3D Visual environment updates
      this.shukaWorld.update(deltaSeconds);
      this.abilitySys.update(deltaSeconds);

      // Alien AI Update (Solo mode: local simulation; Multiplayer: fed by server)
      if (!this.multiplayerMode) {
        const aiResult = this.alienAI.update(deltaSeconds);
        if (aiResult.alienCollectedCore && aiResult.coreId) {
          this.earthWorld.setCoreCollected(aiResult.coreId, true);
          this.registerAlienCore(aiResult.coreId);
          this.audioMgr.playAlienCoreCollected();
        }
      }

      // Update Earth sector rendering with latest Alien data
      this.earthWorld.update(deltaSeconds, {
        position: this.alienAI.position,
        rotation: this.alienAI.rotation,
        state: this.alienAI.state,
        targetCoreId: this.alienAI.targetCoreId,
        extractionProgress: this.alienAI.extractionProgress
      });

      // Input queries
      const moveInput = this.inputMgr.getMoveVector();
      const sprintInput = this.inputMgr.isSprinting();
      const extractHeld = this.inputMgr.isExtracting();
      const cameraDeltas = this.inputMgr.consumeCameraDelta();

      // Camera & Player movement
      this.cameraCtrl.update(deltaSeconds, cameraDeltas);
      this.playerCtrl.update(deltaSeconds, moveInput, sprintInput);

      // Energy Cores update (passes extraction intent to targeted core)
      this.coreManager.update(deltaSeconds, this.playerCtrl.root.position, extractHeld);

      // Extraction beam visual & audio feedback
      const activeExtractingCore = this.coreManager.getActiveExtractingCore();
      if (activeExtractingCore) {
        this.playerCtrl.updateExtractionBeam(activeExtractingCore.meshRoot.position);
        if (!this.wasExtracting) {
          this.audioMgr.startExtractionBeam();
          this.wasExtracting = true;
        }
      } else {
        this.playerCtrl.updateExtractionBeam(null);
        if (this.wasExtracting) {
          this.audioMgr.stopExtractionBeam();
          this.wasExtracting = false;
        }
      }

      // Priority Order:
      // 1. Core collection (already processed in coreCtrl.update via callback)
      // 2. Check Win / Lose
      this.checkWinLose();

      // 3. Check Timer Expiration
      if (this.state === GameState.PLAYING) {
        this.matchTime += deltaSeconds;

        this.emitEvent('TIMER_UPDATED', {
          matchTime: this.matchTime,
          remainingTime: this.getRemainingTime(),
          formattedTime: this.getFormattedTime()
        });

        if (this.getRemainingTime() <= 0) {
          this.state = GameState.LOST;
          this.emitEvent('GAME_LOST', {
            reason: 'TIME_EXPIRED',
            humanCores: this.humanCores,
            alienCores: this.alienCores
          });
          console.log('[GameManager] Match timer expired. State: LOST');
        }
      }
    } else {
      // Non-playing state (MENU, LOBBY, COUNTDOWN, PAUSED, WON, LOST): stop extraction beam
      this.inputMgr.consumeCameraDelta();
      this.playerCtrl.updateExtractionBeam(null);
      if (this.wasExtracting) {
        this.audioMgr.stopExtractionBeam();
        this.wasExtracting = false;
      }
      // Keep Shuka world atmospheric animation active
      this.shukaWorld.update(deltaSeconds * 0.4);
      this.earthWorld.update(deltaSeconds * 0.4, {
        position: this.alienAI.position,
        rotation: this.alienAI.rotation,
        state: this.alienAI.state,
        targetCoreId: this.alienAI.targetCoreId,
        extractionProgress: this.alienAI.extractionProgress
      });
    }

    // 3. Update Multiplayer Operatives Synchronization
    this.multiplayerMgr.update(deltaSeconds, this.state === GameState.PLAYING);

    // 4. Update Temporary Debug HUD
    this.temporaryHUD.update(this, this.coreManager);
  }

  // ==========================================
  // Core Collection & Progress
  // ==========================================

  private handleCoreCollected(payload: CoreCollectedPayload): void {
    if (this.state !== GameState.PLAYING) return;

    if (payload.world === 'SHUKA') {
      const added = this.registerHumanCore(payload.coreId);
      if (added && this.multiplayerMode && this.networkMgr) {
        this.networkMgr.sendShukaCoreCollected(payload.coreId);
      }
    }
  }

  /**
   * Registers a collected core for the Human team.
   * Increments humanCores if not already counted.
   */
  public registerHumanCore(coreId?: string): boolean {
    if (this.state !== GameState.PLAYING) return false;

    // Prevent duplicate counting of the same core
    if (coreId) {
      if (this.collectedCoreIds.has(coreId)) {
        console.warn(`[GameManager] Core '${coreId}' already counted. Ignoring duplicate.`);
        return false;
      }
      this.collectedCoreIds.add(coreId);
    }

    this.humanCores = Math.min(this.MAX_CORES, this.humanCores + 1);
    this.cameraCtrl.addTrauma(0.35);

    console.log(`[GameManager] HUMAN Shuka Core collected: ${this.humanCores} / ${this.MAX_CORES}`);

    if (this.humanCores === 4) {
      GameAnnouncement.show('FINAL CORE', 'One more Shuka Core to win the match!', 'success');
    } else {
      GameAnnouncement.show('SHUKA CORE ACQUIRED', `HUMAN: ${this.humanCores} / 5 CORES`, 'success');
    }

    if ((this.temporaryHUD as any)?.eventFeed) {
      (this.temporaryHUD as any).eventFeed.add(`You collected Shuka Core #${this.humanCores}`, 'success');
    }

    this.emitEvent('HUMAN_CORE_COLLECTED', {
      humanCores: this.humanCores,
      coreId,
      remainingTime: this.getRemainingTime()
    });

    // Check if this triggers a win
    this.checkWinLose();
    return true;
  }

  /**
   * Registers a collected core for the Alien team.
   * Foundation method for future Alien AI integration.
   */
  public registerAlienCore(coreId?: string): boolean {
    if (this.state !== GameState.PLAYING) return false;

    this.alienCores = Math.min(this.MAX_CORES, this.alienCores + 1);
    console.log(`[GameManager] ALIEN Earth Core registered: ${this.alienCores} / ${this.MAX_CORES}`);

    if (this.alienCores === 4) {
      GameAnnouncement.show('ALIEN ONE CORE FROM VICTORY', 'Defend remaining Earth Cores!', 'alien');
    } else {
      GameAnnouncement.show('EARTH CORE ACQUIRED', `ALIEN: ${this.alienCores} / 5 CORES`, 'alien');
    }

    if ((this.temporaryHUD as any)?.eventFeed) {
      (this.temporaryHUD as any).eventFeed.add(`Alien collected Earth Core #${this.alienCores}`, 'alien');
    }

    this.emitEvent('ALIEN_CORE_COLLECTED', {
      alienCores: this.alienCores,
      coreId,
      remainingTime: this.getRemainingTime()
    });

    // Check if this triggers a loss
    this.checkWinLose();
    return true;
  }

  // ==========================================
  // Win / Lose Checks
  // ==========================================

  /**
   * Evaluates win/lose state based on core counts
   */
  public checkWinLose(): void {
    if (this.state !== GameState.PLAYING) return;

    if (this.humanCores >= this.MAX_CORES) {
      this.state = GameState.WON;
      console.log('[GameManager] HUMANITY SECURED SHUKA! State: WON');
      this.emitEvent('GAME_WON', {
        humanCores: this.humanCores,
        alienCores: this.alienCores,
        remainingTime: this.getRemainingTime(),
        formattedTime: this.getFormattedTime()
      });
      this.emitEvent('MATCH_FINISHED', {
        winner: 'HUMAN',
        reason: 'HUMAN_CORES_5'
      });
    } else if (this.alienCores >= this.MAX_CORES) {
      this.state = GameState.LOST;
      console.log('[GameManager] ALIEN CONVERGENCE REACHED! State: LOST');
      this.emitEvent('GAME_LOST', {
        reason: 'ALIEN_CORES_MAX',
        humanCores: this.humanCores,
        alienCores: this.alienCores,
        remainingTime: this.getRemainingTime(),
        formattedTime: this.getFormattedTime()
      });
      this.emitEvent('MATCH_FINISHED', {
        winner: 'ALIEN',
        reason: 'ALIEN_CORES_5'
      });
    }
  }

  // ==========================================
  // Match Controls & Specialist Allocation
  // ==========================================

  /**
   * Phase 10: Applies specialist allocation and configures team bonuses
   */
  public applySpecialistAllocation(allocation: SpecialistAllocation): void {
    this.specialistAllocation = { ...allocation, isLocked: true };
    this.coreManager.applySpecialistModifiers(allocation.shukaExtraction);
    console.log(
      `[GameManager] Applied Specialist Allocation: Earth Defense=${allocation.earthDefense}, Shuka Extraction=${allocation.shukaExtraction}. Modifiers: Earth Readiness=+${Math.round(this.specialistModifiers.earthDefenseBonus * 100)}%, Shuka Extraction=+${Math.round(this.specialistModifiers.shukaExtractionBonus * 100)}% (${this.specialistModifiers.finalShukaExtractionTime.toFixed(2)}s duration)`
    );
    this.emitEvent('SPECIALIST_ALLOCATION_APPLIED', {
      specialists: this.specialistAllocation,
      modifiers: this.specialistModifiers
    });
  }

  public startGame(allocation?: SpecialistAllocation): void {
    if (allocation) {
      this.applySpecialistAllocation(allocation);
    } else {
      this.coreManager.applySpecialistModifiers(this.specialistAllocation.shukaExtraction);
    }

    this.state = GameState.PLAYING;
    this.alienAI.reset();
    this.earthWorld.reset();

    if (this.screenMgr) {
      this.screenMgr.setScreenState(ScreenState.GAMEPLAY);
    }

    // Sync multiplayer state if room exists
    if (this.networkMgr && this.networkMgr.currentRoom) {
      this.multiplayerMode = true;
      this.roomCode = this.networkMgr.currentRoom.code;
      this.localPlayerId = this.networkMgr.localPlayerId;
      this.isHost = this.networkMgr.isHost;

      if (this.networkMgr.currentRoom.players && this.multiplayerMgr.getRemotePlayerCount() === 0) {
        this.multiplayerMgr.handlePlayersInitialState(this.networkMgr.currentRoom.players);
      }
    } else {
      // Single player / solo mode: start local AI pursuit
      this.alienAI.start();
    }

    if (this.lobbyUI) {
      this.lobbyUI.hide();
    }

    if (GameplayTutorialOverlay.shouldShow()) {
      new GameplayTutorialOverlay(document.body, () => {
        // Tutorial dismissed
      });
    }

    console.log(`[GameManager] Match started: Multi=${this.multiplayerMode}, Room=${this.roomCode}, Host=${this.isHost}`);

    this.emitEvent('GAME_STARTED', {
      state: this.state,
      humanCores: this.humanCores,
      alienCores: this.alienCores,
      remainingTime: this.getRemainingTime(),
      formattedTime: this.getFormattedTime(),
      roomCode: this.roomCode || undefined
    });
  }

  public showResultScreen(winner: 'HUMAN' | 'ALIEN' | 'DRAW', reason?: string): void {
    if (this.screenMgr) {
      this.screenMgr.setScreenState(ScreenState.RESULTS);
    }
    if (this.resultScreen) {
      this.resultScreen.show({
        winner,
        shukaCoresCollected: this.humanCores,
        earthCoresLost: this.alienCores,
        missionDurationSeconds: this.matchTime,
        reason,
        isDemoMode: this.isDemoMode
      });
    }
  }

  public handleRematch(requestServer: boolean = true): void {
    this.humanCores = 0;
    this.alienCores = 0;
    this.matchTime = 0;
    this.collectedCoreIds.clear();
    this.coreManager.resetAll();
    this.alienAI.reset();
    this.earthWorld.reset();

    if (requestServer && this.multiplayerMode && this.networkMgr) {
      this.networkMgr.requestRematch();
    }

    this.state = GameState.LOBBY;
    if (this.screenMgr) {
      this.screenMgr.setScreenState(ScreenState.LOBBY);
    }
    if (this.lobbyUI) {
      this.lobbyUI.show();
    }
  }

  public handleReturnToMainMenu(): void {
    this.state = GameState.MENU;
    this.isDemoMode = false;
    if (this.temporaryHUD) {
      this.temporaryHUD.isDemoMode = false;
    }
    this.humanCores = 0;
    this.alienCores = 0;
    this.matchTime = 0;
    this.collectedCoreIds.clear();
    this.coreManager.resetAll();
    this.alienAI.reset();
    this.earthWorld.reset();

    if (this.networkMgr) {
      this.networkMgr.leaveRoom();
    }
    if (this.screenMgr) {
      this.screenMgr.setScreenState(ScreenState.MAIN_MENU);
    }
  }

  public pauseGame(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      console.log('[GameManager] Game PAUSED');
      this.emitEvent('GAME_PAUSED');
    }
  }

  public resumeGame(): void {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      console.log('[GameManager] Game RESUMED');
      this.emitEvent('GAME_RESUMED');
    }
  }

  public resetGame(): void {
    this.state = GameState.PLAYING;
    this.humanCores = 0;
    this.alienCores = 0;
    this.matchTime = 0;
    this.collectedCoreIds.clear();

    if (this.coreManager) {
      this.coreManager.resetAll();
    }

    this.alienAI.reset();
    this.earthWorld.reset();

    if (!this.multiplayerMode) {
      this.alienAI.start();
    }

    if (this.isReconCameraActive) {
      this.toggleReconCamera(false);
    }

    console.log('[GameManager] Match reset: State=PLAYING, Human=0/5, Alien=0/5, Time=05:00');

    this.emitEvent('GAME_RESET', {
      state: this.state,
      humanCores: this.humanCores,
      alienCores: this.alienCores,
      remainingTime: this.getRemainingTime(),
      formattedTime: this.getFormattedTime()
    });
  }

  /**
   * Toggles the tactical Recon Camera between Shuka ground operative and Earth surveillance
   */
  public toggleReconCamera(active?: boolean): boolean {
    this.isReconCameraActive = this.earthWorld.toggleReconCamera(active);
    if (!this.isReconCameraActive) {
      this.scene.activeCamera = this.cameraCtrl.camera;
    }
    return this.isReconCameraActive;
  }

  // ==========================================
  // Timer Helpers
  // ==========================================

  public getRemainingTime(): number {
    return Math.max(0, this.MATCH_DURATION - this.matchTime);
  }

  public getFormattedTime(): string {
    const rem = Math.ceil(this.getRemainingTime());
    const minutes = Math.floor(rem / 60);
    const seconds = rem % 60;
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  // ==========================================
  // Event System
  // ==========================================

  public on(listener: GameEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public emitEvent(eventName: string, payload: GameEventPayload = {}): void {
    // 1. Notify internal listeners
    for (const listener of this.listeners) {
      try {
        listener(eventName, payload);
      } catch (err) {
        console.error(`[GameManager] Listener error on event '${eventName}':`, err);
      }
    }

    // 2. Dispatch DOM event
    try {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            ...payload,
            timestamp: Date.now()
          }
        })
      );
    } catch {
      // In non-DOM testing contexts
    }
  }

  // ==========================================
  // Temporary Debug Interface (window.debugGame)
  // ==========================================

  private setupDebugInterface(): void {
    (window as any).debugGame = {
      addHumanCore: () => {
        // Collect next available core in the world or debug fallback
        const nextAvail = this.coreManager.cores.find((c) => c.state !== CoreState.COLLECTED);
        if (nextAvail) {
          nextAvail.collect();
        } else {
          this.registerHumanCore(`debug-core-${Date.now()}`);
        }
        console.log(`[debugGame] Added Human Core: ${this.humanCores}/5`);
      },
      addAlienCore: () => {
        this.registerAlienCore(`alien-core-${Date.now()}`);
        console.log(`[debugGame] Added Alien Core: ${this.alienCores}/5`);
      },
      reset: () => {
        this.resetGame();
        console.log('[debugGame] Game Reset');
      },
      pause: () => {
        this.pauseGame();
      },
      resume: () => {
        this.resumeGame();
      },
      setTime: (secondsRemaining: number) => {
        this.matchTime = Math.max(0, this.MATCH_DURATION - secondsRemaining);
        console.log(`[debugGame] Set time to ${this.getFormattedTime()} (${secondsRemaining}s remaining)`);
      },
      getNearestAvailableCore: () => {
        return this.coreManager.getNearestAvailableCore(this.playerCtrl.root.position);
      },
      cores: () => {
        return this.coreManager.cores.map((c) => ({
          id: c.coreId,
          name: c.name,
          state: c.state,
          distance: Math.round(
            BABYLON.Vector3.Distance(this.playerCtrl.root.position, c.meshRoot.position)
          )
        }));
      },
      network: this.networkMgr,
      lobby: this.lobbyUI,
      multiplayer: this.multiplayerMgr,
      remotePlayers: () => this.multiplayerMgr.getRemotePlayerList(),
      startSingleplayer: () => {
        this.lobbyUI.hide();
        this.startGame();
      },
      getSpecialists: () => ({
        ...this.specialistAllocation,
        modifiers: this.specialistModifiers
      }),
      setSpecialists: (earth: number, shuka: number) => {
        if (earth + shuka === 5 && earth >= 0 && shuka >= 0) {
          this.applySpecialistAllocation({
            total: 5,
            earthDefense: earth,
            shukaExtraction: shuka,
            isLocked: true
          });
          return true;
        }
        return false;
      },
      getState: () => ({
        state: this.state,
        humanCores: this.humanCores,
        alienCores: this.alienCores,
        specialists: this.specialistAllocation,
        specialistModifiers: this.specialistModifiers,
        remainingTime: this.getRemainingTime(),
        formattedTime: this.getFormattedTime(),
        activeCoresCount: this.coreManager.getActiveCoresCount(),
        collectedCoresCount: this.coreManager.getCollectedCount(),
        multiplayerMode: this.multiplayerMode,
        roomCode: this.roomCode,
        isHost: this.isHost,
        localPlayerId: this.localPlayerId
      })
    };
  }
}
