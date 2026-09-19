import * as BABYLON from 'babylonjs';
import { EarthWorld } from '../worlds/EarthWorld';

export enum AlienState {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  MOVING = 'MOVING',
  EXTRACTING = 'EXTRACTING',
  CORE_COLLECTED = 'CORE_COLLECTED'
}

export interface EarthCoreState {
  id: string;
  name: string;
  position: BABYLON.Vector3;
  collected: boolean;
  extracting: boolean;
}

export const ALIEN_CONFIG = {
  speed: 3.2,              // Configurable speed in m/s (2.0 - 4.0 m/s range)
  extractionDuration: 5.0,  // Configurable extraction time (5.0 seconds)
  arrivalDistance: 1.8      // Distance threshold to trigger extraction
};

/**
 * AlienAI - Manages the Alien AI operative on Planet Earth.
 * - State machine: IDLE -> SEARCHING -> MOVING -> EXTRACTING -> CORE_COLLECTED
 * - Authoritative on server in multiplayer; simulated locally in single-player
 * - Nearest core selection algorithm
 * - Smooth vector movement with directional yaw
 * - Extraction timer (0% to 100%) and telemetry reporting
 */
export class AlienAI {
  // State
  public state: AlienState = AlienState.IDLE;
  public position: BABYLON.Vector3 = new BABYLON.Vector3(0, 1.5, 0);
  public rotation: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
  public targetCoreId: string | null = null;
  public extractionProgress: number = 0.0; // 0.0 to 1.0
  public collectedCores: number = 0;

  // Earth Cores tracking
  public earthCores: EarthCoreState[] = [];

  // Telemetry & diagnostics
  public telemetryText: string = 'AI STANDBY';
  public targetCoreName: string = '';
  public distanceToTarget: number = 0;

  // EMP & Overcharge timers (Phase 11)
  public empStunTimer: number = 0;
  public overchargeDisruptionTimer: number = 0;

  constructor() {
    this.initEarthCores();
    this.reset();
  }

  private initEarthCores(): void {
    this.earthCores = EarthWorld.CORE_LOCATIONS.map((loc, idx) => ({
      id: `earth-core-${idx + 1}`,
      name: EarthWorld.SECTOR_NAMES[idx] || `EARTH CORE ${idx + 1}`,
      position: loc.clone(),
      collected: false,
      extracting: false
    }));
  }

  /**
   * Resets AI state and core collections
   */
  public reset(): void {
    this.state = AlienState.IDLE;
    this.position = new BABYLON.Vector3(0, 1.5, 0);
    this.rotation = new BABYLON.Vector3(0, 0, 0);
    this.targetCoreId = null;
    this.extractionProgress = 0.0;
    this.collectedCores = 0;
    this.telemetryText = 'AI STANDBY';
    this.targetCoreName = '';
    this.distanceToTarget = 0;
    this.empStunTimer = 0;
    this.overchargeDisruptionTimer = 0;

    this.earthCores.forEach((c) => {
      c.collected = false;
      c.extracting = false;
    });
  }

  /**
   * Starts Alien AI pursuit
   */
  public start(): void {
    this.state = AlienState.SEARCHING;
    this.telemetryText = 'SEARCHING FOR TARGET CORE...';
  }

  /**
   * Ingests server authoritative state packet (in multiplayer mode)
   */
  public applyServerUpdate(data: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    state: string;
    targetCoreId: string | null;
    collectedCores: number;
    extractionProgress: number;
    empActive?: boolean;
    empRemaining?: number;
    overchargeActive?: boolean;
    overchargeRemaining?: number;
  }): void {
    this.position.set(data.position.x, data.position.y, data.position.z);
    this.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
    this.state = (data.state as AlienState) || this.state;
    this.targetCoreId = data.targetCoreId;
    this.collectedCores = data.collectedCores;
    this.extractionProgress = data.extractionProgress;

    if (data.empRemaining !== undefined) {
      this.empStunTimer = data.empRemaining;
    }
    if (data.overchargeRemaining !== undefined) {
      this.overchargeDisruptionTimer = data.overchargeRemaining;
    }

    // Resolve target core name and distance
    if (this.targetCoreId) {
      const core = this.earthCores.find((c) => c.id === this.targetCoreId);
      if (core) {
        this.targetCoreName = core.name;
        const dx = core.position.x - this.position.x;
        const dz = core.position.z - this.position.z;
        this.distanceToTarget = Math.sqrt(dx * dx + dz * dz);
      }
    } else {
      this.targetCoreName = '';
      this.distanceToTarget = 0;
    }

    // Format readable telemetry text
    if (this.empStunTimer > 0) {
      this.telemetryText = `⚡ EMP FROZEN: ${this.empStunTimer.toFixed(1)}s`;
      return;
    }
    if (this.overchargeDisruptionTimer > 0) {
      this.telemetryText = `⚡⚡ OVERCHARGE DISRUPTED: ${this.overchargeDisruptionTimer.toFixed(1)}s`;
      return;
    }

    switch (this.state) {
      case AlienState.IDLE:
        this.telemetryText = 'AI STANDBY';
        break;
      case AlienState.SEARCHING:
        this.telemetryText = 'LOCATING EARTH CORE...';
        break;
      case AlienState.MOVING:
        this.telemetryText = `EN ROUTE: ${this.targetCoreName} [${this.distanceToTarget.toFixed(1)}m]`;
        break;
      case AlienState.EXTRACTING: {
        const pct = Math.floor(this.extractionProgress * 100);
        this.telemetryText = `EXTRACTING: ${this.targetCoreName} [${pct}%]`;
        break;
      }
      case AlienState.CORE_COLLECTED:
        this.telemetryText = `SECURED: ${this.targetCoreName} (${this.collectedCores}/5)`;
        break;
    }
  }

  /**
   * Marks a core as collected by the Alien
   */
  public markCoreCollected(coreId: string): void {
    const core = this.earthCores.find((c) => c.id === coreId);
    if (core) {
      core.collected = true;
      core.extracting = false;
    }
  }

  /**
   * Local state machine tick (used in solo play or when offline)
   */
  public update(deltaSeconds: number): { alienCollectedCore: boolean; coreName: string | null; coreId: string | null } {
    let alienCollectedCore = false;
    let coreName: string | null = null;
    let coreId: string | null = null;

    if (this.empStunTimer > 0) {
      this.empStunTimer = Math.max(0, this.empStunTimer - deltaSeconds);
      this.telemetryText = `⚡ EMP FROZEN [${this.empStunTimer.toFixed(1)}s]`;
      return { alienCollectedCore: false, coreName: null, coreId: null };
    }

    if (this.overchargeDisruptionTimer > 0) {
      this.overchargeDisruptionTimer = Math.max(0, this.overchargeDisruptionTimer - deltaSeconds);
      this.telemetryText = `⚡⚡ OVERCHARGE DISRUPTED [${this.overchargeDisruptionTimer.toFixed(1)}s]`;
    }

    switch (this.state) {
      case AlienState.IDLE: {
        // Wait for match start
        break;
      }

      case AlienState.SEARCHING: {
        // Find nearest uncollected Earth Core
        let closestCore: EarthCoreState | null = null;
        let minDistance = Infinity;

        for (const core of this.earthCores) {
          if (!core.collected) {
            const dx = core.position.x - this.position.x;
            const dz = core.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDistance) {
              minDistance = dist;
              closestCore = core;
            }
          }
        }

        if (closestCore) {
          this.targetCoreId = closestCore.id;
          this.targetCoreName = closestCore.name;
          this.distanceToTarget = minDistance;
          this.state = AlienState.MOVING;
          this.extractionProgress = 0;
          this.telemetryText = `EN ROUTE: ${closestCore.name} [${minDistance.toFixed(1)}m]`;
        } else {
          this.state = AlienState.IDLE;
          this.targetCoreId = null;
          this.telemetryText = 'ALL EARTH CORES EXTRACTED';
        }
        break;
      }

      case AlienState.MOVING: {
        const targetCore = this.earthCores.find((c) => c.id === this.targetCoreId);
        if (!targetCore || targetCore.collected) {
          this.state = AlienState.SEARCHING;
          this.targetCoreId = null;
          break;
        }

        const dx = targetCore.position.x - this.position.x;
        const dz = targetCore.position.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        this.distanceToTarget = dist;

        if (dist <= ALIEN_CONFIG.arrivalDistance) {
          this.state = AlienState.EXTRACTING;
          this.extractionProgress = 0;
          targetCore.extracting = true;
          this.telemetryText = `EXTRACTING: ${targetCore.name}`;
        } else {
          const nx = dx / dist;
          const nz = dz / dist;
          const step = Math.min(dist, ALIEN_CONFIG.speed * deltaSeconds);
          this.position.x += nx * step;
          this.position.z += nz * step;
          this.position.y = 1.5 + Math.sin(Date.now() * 0.005) * 0.2;
          this.rotation.y = Math.atan2(dx, dz);
          this.telemetryText = `EN ROUTE: ${targetCore.name} [${dist.toFixed(1)}m]`;
        }
        break;
      }

      case AlienState.EXTRACTING: {
        const targetCore = this.earthCores.find((c) => c.id === this.targetCoreId);
        if (!targetCore || targetCore.collected) {
          this.state = AlienState.SEARCHING;
          this.targetCoreId = null;
          break;
        }

        targetCore.extracting = true;
        if (this.overchargeDisruptionTimer <= 0) {
          this.extractionProgress = Math.min(1.0, this.extractionProgress + deltaSeconds / ALIEN_CONFIG.extractionDuration);
        }
        const pct = Math.floor(this.extractionProgress * 100);
        this.telemetryText = this.overchargeDisruptionTimer > 0
          ? `⚡⚡ OVERCHARGE DISRUPTED: ${Math.ceil(this.overchargeDisruptionTimer)}s`
          : `EXTRACTING: ${targetCore.name} [${pct}%]`;

        if (this.extractionProgress >= 1.0) {
          targetCore.collected = true;
          targetCore.extracting = false;
          this.collectedCores = Math.min(5, this.collectedCores + 1);
          alienCollectedCore = true;
          coreName = targetCore.name;
          coreId = targetCore.id;
          this.state = AlienState.CORE_COLLECTED;
          this.telemetryText = `SECURED: ${targetCore.name} (${this.collectedCores}/5)`;
        }
        break;
      }

      case AlienState.CORE_COLLECTED: {
        this.extractionProgress = 0;
        this.targetCoreId = null;
        this.state = AlienState.SEARCHING;
        break;
      }
    }

    return { alienCollectedCore, coreName, coreId };
  }

  public applyEMP(duration: number = 5.0): void {
    this.empStunTimer = duration;
  }

  public applyOvercharge(disruptionAmount: number = 0.25, duration: number = 2.0): void {
    if (this.state === AlienState.EXTRACTING) {
      this.extractionProgress = Math.max(0, this.extractionProgress - disruptionAmount);
      this.overchargeDisruptionTimer = duration;
    }
  }
}
