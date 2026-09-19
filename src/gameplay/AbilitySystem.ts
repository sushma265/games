import * as BABYLON from 'babylonjs';
import { AlienAI } from './AlienAI';
import { CoreController } from './CoreController';
import { CoreManager } from './CoreManager';
import { EarthWorld } from '../worlds/EarthWorld';
import { AudioManager } from '../core/AudioManager';
import { CameraController } from '../player/CameraController';
import { NetworkManager } from '../network/NetworkManager';
import { AbilityCooldownManager } from './AbilityCooldownManager';
import { AbilityId, ABILITY_CONFIG, GAME_BALANCE } from '../types';

export interface AbilityState {
  id: 1 | 2 | 3;
  key: AbilityId;
  name: string;
  hotkey: string;
  cooldownMax: number;
  currentCooldown: number;
  isActive: boolean;
  activeDuration: number;
  activeRemaining: number;
  description: string;
}

export interface AbilityFeedback {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: number;
  duration: number; // in seconds
}

/**
 * Phase 11: Comprehensive Authoritative & Client Ability System
 * Controls:
 * [E] -> EMP SURGE (id: 1)
 * [Q] -> OVERCHARGE (id: 2)
 * [R] -> SCAN (id: 3)
 */
export class AbilitySystem {
  private alienAI: AlienAI;
  private coreManager: CoreManager | null = null;
  private coreCtrlFallback: CoreController | null = null;
  private audioMgr: AudioManager;
  private cameraCtrl: CameraController;
  private earthWorld: EarthWorld | null = null;
  private networkMgr: NetworkManager | null = null;
  private specialistModifiersProvider?: () => any;
  private playerPositionProvider?: () => BABYLON.Vector3;

  public cooldownMgr: AbilityCooldownManager;

  // Active waypoint target from scan
  public scanTargetCoreId: string | null = null;
  public scanTargetCoreName: string = '';
  public scanTargetDistance: number = 0;

  // Feedback banner state for HUD
  public currentFeedback: AbilityFeedback | null = null;

  constructor(
    alienAI: AlienAI,
    coreSource: CoreManager | CoreController,
    audioMgr: AudioManager,
    cameraCtrl: CameraController,
    earthWorld?: EarthWorld,
    networkMgr?: NetworkManager,
    specialistModifiersProvider?: () => any,
    playerPositionProvider?: () => BABYLON.Vector3
  ) {
    this.alienAI = alienAI;
    if ('cores' in coreSource && Array.isArray((coreSource as any).cores)) {
      this.coreManager = coreSource as CoreManager;
    } else {
      this.coreCtrlFallback = coreSource as CoreController;
    }

    this.audioMgr = audioMgr;
    this.cameraCtrl = cameraCtrl;
    this.earthWorld = earthWorld || null;
    this.networkMgr = networkMgr || null;
    this.specialistModifiersProvider = specialistModifiersProvider;
    this.playerPositionProvider = playerPositionProvider;

    this.cooldownMgr = new AbilityCooldownManager();

    // Wire up multiplayer socket events if network manager is provided
    if (this.networkMgr) {
      this.initNetworkListeners();
    }
  }

  public setNetworkManager(net: NetworkManager): void {
    this.networkMgr = net;
    this.initNetworkListeners();
  }

  public setEarthWorld(world: EarthWorld): void {
    this.earthWorld = world;
  }

  public setCoreManager(mgr: CoreManager): void {
    this.coreManager = mgr;
  }

  public setPlayerPositionProvider(provider: () => BABYLON.Vector3): void {
    this.playerPositionProvider = provider;
  }

  public setSpecialistModifiersProvider(provider: () => any): void {
    this.specialistModifiersProvider = provider;
  }

  private initNetworkListeners(): void {
    if (!this.networkMgr) return;

    this.networkMgr.on('ABILITY_ACTIVATED', (data: {
      playerId: string;
      playerName: string;
      ability: AbilityId;
      duration: number;
      cooldown: number;
      setback?: number;
    }) => {
      this.handleRemoteAbilityActivated(data);
    });

    this.networkMgr.on('ABILITY_COOLDOWN_STARTED', (data: {
      ability: AbilityId;
      cooldown: number;
      duration: number;
    }) => {
      this.cooldownMgr.startCooldown(data.ability, data.cooldown, data.duration);
    });

    this.networkMgr.on('ABILITY_REJECTED', (data: { ability: string; reason: string }) => {
      this.showFeedback(data.reason || 'Ability unavailable', 'warning', 2.5);
    });

    this.networkMgr.on('EMP_STATE_UPDATED', (data: { active: boolean; duration?: number; until?: number }) => {
      if (data.active && data.duration) {
        if (this.earthWorld) this.earthWorld.triggerEMPDisruption(data.duration);
        this.alienAI.applyEMP(data.duration);
      }
    });

    this.networkMgr.on('OVERCHARGE_STATE_UPDATED', (data: { active: boolean; duration?: number; setback?: number }) => {
      if (data.active) {
        const dur = data.duration ?? GAME_BALANCE.abilities.overchargeDuration;
        const setback = data.setback ?? GAME_BALANCE.abilities.overchargeBaseReduction;
        if (this.earthWorld) this.earthWorld.triggerOverchargeDisruption(dur);
        this.alienAI.applyOvercharge(setback, dur);
      }
    });

    this.networkMgr.on('SCAN_RESULT', (data: {
      targetCoreId: string;
      targetCoreName: string;
      duration: number;
      distance: number;
    }) => {
      this.handleScanResult(data);
    });
  }

  /**
   * Translates 1 | 2 | 3 or string into strongly typed AbilityId
   */
  public normalizeAbilityId(id: 1 | 2 | 3 | string): AbilityId | null {
    if (id === 1) return 'EMP_SURGE';
    if (id === 2) return 'OVERCHARGE';
    if (id === 3) return 'SCAN';

    const s = String(id).toUpperCase().trim();
    if (s === 'EMP_SURGE' || s === 'EMPSURGE' || s === 'EMP') return 'EMP_SURGE';
    if (s === 'OVERCHARGE') return 'OVERCHARGE';
    if (s === 'SCAN') return 'SCAN';
    return null;
  }

  /**
   * Ticks cooldowns, active effects, and UI feedback
   */
  public update(deltaSeconds: number): void {
    // Tick centralized cooldown manager
    this.cooldownMgr.update(deltaSeconds);

    // Tick feedback banner
    if (this.currentFeedback) {
      this.currentFeedback.duration -= deltaSeconds;
      if (this.currentFeedback.duration <= 0) {
        this.currentFeedback = null;
      }
    }

    // Update scan waypoint distance if scan is active
    if (this.cooldownMgr.isEffectActive('SCAN')) {
      if (this.coreManager && this.scanTargetCoreId) {
        const core = this.coreManager.getCoreById(this.scanTargetCoreId);
        if (core && this.playerPositionProvider) {
          const playerPos = this.playerPositionProvider();
          this.scanTargetDistance = BABYLON.Vector3.Distance(playerPos, core.meshRoot.position);
        }
      }
    } else {
      if (this.scanTargetCoreId) {
        this.scanTargetCoreId = null;
      }
    }
  }

  /**
   * Main entrypoint for activating an ability via keyboard shortcut, HUD click, or touch
   */
  public activateAbility(target: 1 | 2 | 3 | string): { success: boolean; message?: string } {
    const abilityId = this.normalizeAbilityId(target);
    if (!abilityId) {
      return { success: false, message: 'Invalid ability' };
    }

    // 1. Cooldown validation
    if (!this.cooldownMgr.canUse(abilityId)) {
      const remaining = Math.ceil(this.cooldownMgr.getRemainingCooldown(abilityId));
      const message = `${ABILITY_CONFIG[abilityId].name} RECHARGING: ${remaining}s`;
      this.showFeedback(message, 'warning', 1.8);
      return { success: false, message };
    }

    // 2. Multiplayer authoritative request
    if (this.networkMgr && this.networkMgr.isConnected() && this.networkMgr.currentRoom) {
      const playerPos = this.playerPositionProvider ? this.playerPositionProvider() : undefined;
      const vPos = playerPos ? { x: playerPos.x, y: playerPos.y, z: playerPos.z } : undefined;
      this.networkMgr.sendUseAbility(abilityId, vPos);
      return { success: true, message: `Dispatched ${ABILITY_CONFIG[abilityId].name}` };
    }

    // 3. Single-Player / Offline Local Authoritative Execution
    return this.executeLocalAbility(abilityId);
  }

  /**
   * Local authoritative resolution when in single-player mode
   */
  private executeLocalAbility(abilityId: AbilityId): { success: boolean; message?: string } {
    const config = ABILITY_CONFIG[abilityId];

    if (abilityId === 'EMP_SURGE') {
      if (this.alienAI.state !== 'EXTRACTING') {
        const message = 'Alien Harvester is not currently extracting an Earth Core';
        this.showFeedback(message, 'warning', 2.2);
        return { success: false, message };
      }

      this.cooldownMgr.startCooldown('EMP_SURGE', config.cooldown, config.duration);
      this.audioMgr.playEMPSurge();
      this.cameraCtrl.addTrauma(0.45);
      this.alienAI.applyEMP(config.duration);
      if (this.earthWorld) this.earthWorld.triggerEMPDisruption(config.duration);

      const message = '⚡ EMP SURGE DELIVERED // ALIEN HARVESTER PAUSED FOR 5s';
      this.showFeedback(message, 'success', 3.0);
      return { success: true, message };
    }

    if (abilityId === 'OVERCHARGE') {
      if (this.alienAI.state !== 'EXTRACTING') {
        const message = 'Alien Harvester is not currently extracting an Earth Core';
        this.showFeedback(message, 'warning', 2.2);
        return { success: false, message };
      }

      const edBonus = this.specialistModifiersProvider ? (this.specialistModifiersProvider().earthDefenseBonus || 0) : 0;
      const setback = config.baseReduction * (1 + edBonus);

      this.cooldownMgr.startCooldown('OVERCHARGE', config.cooldown, config.duration);
      this.audioMgr.playOvercharge();
      this.cameraCtrl.addTrauma(0.5);
      this.alienAI.applyOvercharge(setback, config.duration);
      if (this.earthWorld) this.earthWorld.triggerOverchargeDisruption(config.duration);

      const message = `⚡⚡ OVERCHARGE DISCHARGED // EXTRACTION SET BACK ${Math.round(setback * 100)}%`;
      this.showFeedback(message, 'success', 3.0);
      return { success: true, message };
    }

    if (abilityId === 'SCAN') {
      const playerPos = this.playerPositionProvider ? this.playerPositionProvider() : new BABYLON.Vector3(0, 1.2, 0);

      let targetCore: CoreController | null = null;
      let minDistance = Infinity;

      if (this.coreManager) {
        const nearestInfo = this.coreManager.getNearestCoreToPlayer(playerPos);
        if (nearestInfo) {
          targetCore = nearestInfo.core;
          minDistance = nearestInfo.distance;
        }
      } else if (this.coreCtrlFallback) {
        if (!this.coreCtrlFallback.isExtracted) {
          targetCore = this.coreCtrlFallback;
          minDistance = BABYLON.Vector3.Distance(playerPos, targetCore.meshRoot.position);
        }
      }

      if (!targetCore) {
        const message = 'All Shuka Energy Cores have already been collected';
        this.showFeedback(message, 'warning', 2.0);
        return { success: false, message };
      }

      this.cooldownMgr.startCooldown('SCAN', config.cooldown, config.duration);
      this.audioMgr.playScanPing();
      targetCore.setScanActive(true, config.duration);

      this.scanTargetCoreId = targetCore.coreId;
      this.scanTargetCoreName = targetCore.name;
      this.scanTargetDistance = minDistance;

      const message = `LONG-RANGE SCAN ACTIVE // ${targetCore.name.toUpperCase()} [${Math.round(minDistance)}m]`;
      this.showFeedback(message, 'info', 3.0);
      return { success: true, message };
    }

    return { success: false, message: 'Unknown ability' };
  }

  /**
   * Handles remote or local activation broadcast
   */
  private handleRemoteAbilityActivated(data: {
    playerId: string;
    playerName: string;
    ability: AbilityId;
    duration: number;
    cooldown: number;
    setback?: number;
  }): void {
    const isLocal = this.networkMgr?.socket?.id === data.playerId;

    if (data.ability === 'EMP_SURGE') {
      this.audioMgr.playEMPSurge();
      this.cameraCtrl.addTrauma(0.35);
      if (this.earthWorld) this.earthWorld.triggerEMPDisruption(data.duration);
      this.alienAI.applyEMP(data.duration);

      const msg = isLocal
        ? '⚡ EMP SURGE DELIVERED // ALIEN HARVESTER PAUSED FOR 5s'
        : `⚡ ${data.playerName} TRIGGERED EMP // ALIEN PAUSED FOR 5s`;
      this.showFeedback(msg, 'success', 3.0);
    } else if (data.ability === 'OVERCHARGE') {
      this.audioMgr.playOvercharge();
      this.cameraCtrl.addTrauma(0.4);
      const setbackPct = Math.round((data.setback ?? 0.25) * 100);
      if (this.earthWorld) this.earthWorld.triggerOverchargeDisruption(data.duration);
      this.alienAI.applyOvercharge(data.setback ?? 0.25, data.duration);

      const msg = isLocal
        ? `⚡⚡ OVERCHARGE DISCHARGED // EXTRACTION SET BACK ${setbackPct}%`
        : `⚡⚡ ${data.playerName} TRIGGERED OVERCHARGE // EXTRACTION -${setbackPct}%`;
      this.showFeedback(msg, 'success', 3.0);
    } else if (data.ability === 'SCAN') {
      this.audioMgr.playScanPing();
      const msg = isLocal
        ? 'LONG-RANGE SCAN ACTIVE // CORES HIGHLIGHTED'
        : `${data.playerName} INITIATED RECON SCAN`;
      this.showFeedback(msg, 'info', 2.5);
    }
  }

  /**
   * Handles personal scan result waypoint packet from server
   */
  private handleScanResult(data: {
    targetCoreId: string;
    targetCoreName: string;
    duration: number;
    distance: number;
  }): void {
    this.scanTargetCoreId = data.targetCoreId;
    this.scanTargetCoreName = data.targetCoreName;
    this.scanTargetDistance = data.distance;

    if (this.coreManager) {
      this.coreManager.highlightCoreForScan(data.targetCoreId, data.duration);
    }

    const message = `SCAN LOCKED // ${data.targetCoreName.toUpperCase()} [${Math.round(data.distance)}m]`;
    this.showFeedback(message, 'info', 3.5);
  }

  public showFeedback(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info', duration: number = 2.5): void {
    this.currentFeedback = {
      message,
      type,
      timestamp: Date.now(),
      duration
    };
  }

  // ==========================================
  // Public Getters for HUD & UI View Models
  // ==========================================

  public isReady(id: 1 | 2 | 3 | string): boolean {
    const aid = this.normalizeAbilityId(id);
    if (!aid) return false;
    return this.cooldownMgr.canUse(aid);
  }

  public getCooldown(id: 1 | 2 | 3 | string): number {
    const aid = this.normalizeAbilityId(id);
    if (!aid) return 0;
    return this.cooldownMgr.getRemainingCooldown(aid);
  }

  public getActiveRemaining(id: 1 | 2 | 3 | string): number {
    const aid = this.normalizeAbilityId(id);
    if (!aid) return 0;
    return this.cooldownMgr.getActiveRemaining(aid);
  }

  public isEffectActive(id: 1 | 2 | 3 | string): boolean {
    const aid = this.normalizeAbilityId(id);
    if (!aid) return false;
    return this.cooldownMgr.isEffectActive(aid);
  }

  public getAbilityCardState(id: 1 | 2 | 3): AbilityState {
    const aid: AbilityId = id === 1 ? 'EMP_SURGE' : id === 2 ? 'OVERCHARGE' : 'SCAN';
    const config = ABILITY_CONFIG[aid];
    const currentCooldown = this.cooldownMgr.getRemainingCooldown(aid);
    const activeRemaining = this.cooldownMgr.getActiveRemaining(aid);

    return {
      id,
      key: aid,
      name: config.name,
      hotkey: config.hotkey,
      cooldownMax: config.cooldown,
      currentCooldown,
      isActive: activeRemaining > 0,
      activeDuration: config.duration,
      activeRemaining,
      description: config.description
    };
  }
}
