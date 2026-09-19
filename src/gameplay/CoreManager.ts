import * as BABYLON from 'babylonjs';
import { AudioManager } from '../core/AudioManager';
import { CoreController, CoreState, CoreCollectedPayload } from './CoreController';
import { ShukaWorld } from '../worlds/ShukaWorld';
import { SPECIALIST_CONFIG } from '../types';

export interface CoreDefinition {
  id: string;
  name: string;
  position: BABYLON.Vector3;
  phaseOffset: number;
  rotationSpeed: number;
}

/**
 * CoreManager - Manages the five Shuka Energy Cores (Phase 6):
 * - Instantiates 5 CoreController instances with unique IDs and distinct locations
 * - Stores cores and provides query APIs: find by ID, active count, collected count
 * - Exposes getNearestAvailableCore(playerPosition) for future Scan ability integration
 * - Routes per-frame update calls ensuring clean, single-core extraction
 * - Preserves existing CoreController mechanics and duplicate collection protection
 * - Resets all cores to AVAILABLE state on match reset
 */
export class CoreManager {
  public scene: BABYLON.Scene;
  public audioMgr: AudioManager;
  public cores: CoreController[] = [];
  public onCoreCollectedCallback?: (payload: CoreCollectedPayload) => void;

  // Static configurations for the 5 Shuka Cores
  public static readonly SHUKA_CORE_CONFIGS: CoreDefinition[] = [
    {
      id: 'shuka-core-1',
      name: 'Shuka Core 1',
      position: ShukaWorld.CORE_LOCATIONS[0] || new BABYLON.Vector3(0, 1.8, 22),
      phaseOffset: 0.0,
      rotationSpeed: 1.0
    },
    {
      id: 'shuka-core-2',
      name: 'Shuka Core 2',
      position: ShukaWorld.CORE_LOCATIONS[1] || new BABYLON.Vector3(38, 2.2, 12),
      phaseOffset: 1.25,
      rotationSpeed: 1.15
    },
    {
      id: 'shuka-core-3',
      name: 'Shuka Core 3',
      position: ShukaWorld.CORE_LOCATIONS[2] || new BABYLON.Vector3(-32, 2.0, 30),
      phaseOffset: 2.5,
      rotationSpeed: 0.9
    },
    {
      id: 'shuka-core-4',
      name: 'Shuka Core 4',
      position: ShukaWorld.CORE_LOCATIONS[3] || new BABYLON.Vector3(26, 2.5, -34),
      phaseOffset: 3.75,
      rotationSpeed: 1.05
    },
    {
      id: 'shuka-core-5',
      name: 'Shuka Core 5',
      position: ShukaWorld.CORE_LOCATIONS[4] || new BABYLON.Vector3(-36, 2.2, -26),
      phaseOffset: 5.0,
      rotationSpeed: 0.95
    }
  ];

  constructor(
    scene: BABYLON.Scene,
    audioMgr: AudioManager,
    onCoreCollected?: (payload: CoreCollectedPayload) => void
  ) {
    this.scene = scene;
    this.audioMgr = audioMgr;
    this.onCoreCollectedCallback = onCoreCollected;

    this.createCores();
  }

  /**
   * Instantiates the 5 unique Shuka Energy Cores
   */
  private createCores(): void {
    this.cores = [];

    for (const config of CoreManager.SHUKA_CORE_CONFIGS) {
      const core = new CoreController(this.scene, this.audioMgr, config.position, {
        coreId: config.id,
        name: config.name,
        world: 'SHUKA',
        phaseOffset: config.phaseOffset,
        rotationSpeed: config.rotationSpeed
      });

      core.onCoreCollected = (payload: CoreCollectedPayload) => {
        if (this.onCoreCollectedCallback) {
          this.onCoreCollectedCallback(payload);
        }
      };

      this.cores.push(core);
    }

    console.log(`[CoreManager] Initialized ${this.cores.length} Shuka Energy Cores.`);
  }

  /**
   * Find a core by its unique ID (e.g. 'shuka-core-3')
   */
  public getCoreById(coreId: string): CoreController | undefined {
    return this.cores.find((c) => c.coreId === coreId);
  }

  /**
   * Count remaining active cores (AVAILABLE or EXTRACTING)
   */
  public getActiveCoresCount(): number {
    return this.cores.filter((c) => c.state !== CoreState.COLLECTED).length;
  }

  /**
   * Count collected cores
   */
  public getCollectedCount(): number {
    return this.cores.filter((c) => c.state === CoreState.COLLECTED).length;
  }

  /**
   * Returns the core currently undergoing active extraction, if any
   */
  public getActiveExtractingCore(): CoreController | null {
    for (const core of this.cores) {
      if (core.state === CoreState.EXTRACTING) {
        return core;
      }
    }
    return null;
  }

  /**
   * Returns the closest available core to the player (ignores COLLECTED cores)
   * Section 12 Specification:
   * 1. Ignore collected cores.
   * 2. Calculate distance from player.
   * 3. Return closest available Shuka core, or null if no cores remain.
   */
  public getNearestAvailableCore(playerPosition: BABYLON.Vector3): CoreController | null {
    let nearestCore: CoreController | null = null;
    let minDistance = Infinity;

    for (const core of this.cores) {
      if (core.state === CoreState.COLLECTED) {
        continue;
      }

      const dist = BABYLON.Vector3.Distance(playerPosition, core.meshRoot.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCore = core;
      }
    }

    return nearestCore;
  }

  /**
   * Returns the nearest core to the player and its distance, regardless of whether it is in range
   */
  public getNearestCoreToPlayer(
    playerPosition: BABYLON.Vector3
  ): { core: CoreController; distance: number } | null {
    const nearest = this.getNearestAvailableCore(playerPosition);
    if (!nearest) return null;
    const distance = BABYLON.Vector3.Distance(playerPosition, nearest.meshRoot.position);
    return { core: nearest, distance };
  }

  /**
   * Frame update for all 5 cores:
   * - Identifies which core is targeted by the player's extraction action
   * - Prevents multi-core simultaneous extraction
   */
  public update(
    deltaSeconds: number,
    playerPosition: BABYLON.Vector3,
    isExtractActionHeld: boolean
  ): void {
    // 1. Determine if a core is already extracting
    let activeExtracting = this.getActiveExtractingCore();

    // 2. If no core is currently extracting, find the closest available core within interaction range
    let primaryInteractiveCore: CoreController | null = activeExtracting;
    if (!primaryInteractiveCore && isExtractActionHeld) {
      let closestInRange: CoreController | null = null;
      let closestDistance = Infinity;

      for (const core of this.cores) {
        if (core.state === CoreState.AVAILABLE) {
          const dist = BABYLON.Vector3.Distance(playerPosition, core.meshRoot.position);
          if (dist <= core.interactionRadius && dist < closestDistance) {
            closestDistance = dist;
            closestInRange = core;
          }
        }
      }
      primaryInteractiveCore = closestInRange;
    }

    // 3. Update each core, passing extraction intent ONLY to the designated interactive core
    for (const core of this.cores) {
      const isThisCoreExtracting = core === primaryInteractiveCore && isExtractActionHeld;
      core.update(deltaSeconds, playerPosition, isThisCoreExtracting);
    }
  }

  /**
   * Resets all 5 cores to AVAILABLE state and zeroes extraction progress
   */
  public resetAll(): void {
    for (const core of this.cores) {
      core.reset();
    }
    console.log('[CoreManager] All 5 Shuka Cores reset to AVAILABLE');
  }

  /**
   * Phase 10: Apply specialist modifier to core extraction time
   * Base extraction time: 4.0s
   * With 0 specialists: 4.0s
   * With 3 specialists (+15%): 3.48s
   * With 5 specialists (+25%): 3.20s
   */
  public applySpecialistModifiers(shukaExtractionSpecialists: number): void {
    const bonus = shukaExtractionSpecialists * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist;
    const duration = SPECIALIST_CONFIG.baseShukaExtractionTime / (1 + bonus);
    for (const core of this.cores) {
      core.extractionDuration = duration;
    }
    console.log(
      `[CoreManager] Applied specialist extraction duration: ${duration.toFixed(2)}s (${shukaExtractionSpecialists} specialists, +${Math.round(bonus * 100)}% speed)`
    );
  }

  /**
   * Phase 11: Highlights a specific Shuka Core when SCAN ability is triggered
   */
  public highlightCoreForScan(coreId: string, duration: number = 5.0): CoreController | null {
    let targetedCore: CoreController | null = null;
    for (const core of this.cores) {
      if (core.coreId === coreId) {
        core.setScanActive(true, duration);
        targetedCore = core;
      } else {
        core.setScanActive(false);
      }
    }
    return targetedCore;
  }

  /**
   * Returns the core currently highlighted by SCAN, if any
   */
  public getScanActiveCore(): CoreController | null {
    for (const core of this.cores) {
      if (core.isScanActive) {
        return core;
      }
    }
    return null;
  }
}
