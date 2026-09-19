import * as BABYLON from 'babylonjs';
import { AudioManager } from '../core/AudioManager';

export enum CoreState {
  AVAILABLE = 'AVAILABLE',
  EXTRACTING = 'EXTRACTING',
  COLLECTED = 'COLLECTED'
}

export interface CoreCollectedPayload {
  coreId: string;
  world: string;
}

export interface CoreConfig {
  coreId?: string;
  name?: string;
  world?: string;
  position?: BABYLON.Vector3;
  phaseOffset?: number;
  rotationSpeed?: number;
}

/**
 * CoreController - Manages an Energy Core on Planet Shuka:
 * - Creation of futuristic crystalline/metallic floating core
 * - Proximity detection (interaction radius)
 * - State machine: AVAILABLE -> EXTRACTING -> COLLECTED
 * - 4-second hold-to-extract progress
 * - Immediate reset on key release or moving out of range
 * - Visual effects (pulsing light, rotating cage, extraction ring, particles, intensified glow)
 * - Game event emission (CORE_COLLECTED) and console debugging
 * - collect() and reset() API
 */
export class CoreController {
  public scene: BABYLON.Scene;
  private audioMgr: AudioManager;

  // Identity & Placement
  public readonly coreId: string;
  public readonly name: string;
  public readonly world: string = 'SHUKA';
  public position: BABYLON.Vector3;
  public readonly baseY: number;

  // Visual Variation parameters
  public readonly phaseOffset: number;
  public readonly rotationSpeedMultiplier: number;

  // State
  public state: CoreState = CoreState.AVAILABLE;
  public extractionDuration: number = 4.0; // 4.0 seconds as specified in Phase 4
  public extractionProgress: number = 0.0; // 0.0 to 1.0
  public interactionRadius: number = 5.0; // 5.0 meters proximity detection
  public isPlayerInRange: boolean = false;
  public playerDistance: number = Infinity;

  // Temporary cancellation feedback timer
  public showCancelledFeedback: boolean = false;
  private cancelledTimer: number = 0;

  // Compatibility properties for future phases / whole-project type-checking
  public get shukaCoresCollected(): number {
    return this.state === CoreState.COLLECTED ? 1 : 0;
  }
  public earthCoresCollected: number = 0;
  public earthCores: Array<{ id: number; name: string; position: BABYLON.Vector3; isExtracted: boolean; extractionProgress: number }> = [];
  public isScanActive: boolean = false;
  public scanTargetCore: any = null;
  public scanTargetDistance: number = 0;

  public get activeExtractingCore(): any {
    return this.state === CoreState.EXTRACTING ? this : null;
  }

  public get nearestCoreToPlayer(): { core: any; distance: number } | null {
    return this.isPlayerInRange ? { core: this, distance: this.playerDistance } : null;
  }

  public scanTimer: number = 0;

  public setScanActive(active: boolean, duration: number = 5.0): void {
    this.isScanActive = active;
    this.scanTimer = active ? duration : 0;
    if (!active && this.beaconMat) {
      this.beaconMat.alpha = 0.16;
      this.beaconPillar.scaling.x = 1.0;
      this.beaconPillar.scaling.z = 1.0;
    }
  }

  public get isExtracted(): boolean {
    return this.state === CoreState.COLLECTED;
  }

  // Visual Meshes & Nodes
  public meshRoot!: BABYLON.TransformNode;
  public innerSphere!: BABYLON.Mesh;
  public outerCage!: BABYLON.Mesh;
  public extractionRing!: BABYLON.Mesh;
  public beaconPillar!: BABYLON.Mesh;
  public groundRing!: BABYLON.Mesh;
  public pointLight!: BABYLON.PointLight;
  public particles!: BABYLON.ParticleSystem;

  // Materials for active vs inactive states
  private plasmaMat!: BABYLON.StandardMaterial;
  private cageMat!: BABYLON.StandardMaterial;
  private ringMat!: BABYLON.StandardMaterial;
  private beaconMat!: BABYLON.StandardMaterial;

  // Event callbacks
  public onCoreCollected?: (payload: CoreCollectedPayload) => void;

  // Animation timeline
  private animTime: number = 0;

  constructor(
    scene: BABYLON.Scene,
    audioMgr: AudioManager,
    position?: BABYLON.Vector3,
    config?: Partial<CoreConfig>
  ) {
    this.scene = scene;
    this.audioMgr = audioMgr;

    this.coreId = config?.coreId || 'shuka-core-1';
    this.name = config?.name || (this.coreId === 'shuka-core-1' ? 'Shuka Core 1' : this.coreId);
    this.world = config?.world || 'SHUKA';
    this.phaseOffset = config?.phaseOffset ?? 0;
    this.rotationSpeedMultiplier = config?.rotationSpeed ?? 1.0;

    // Default position: directly ahead of player start (0, 1.2, 0) at z = 14m
    const pos = position || config?.position || new BABYLON.Vector3(0, 1.8, 14.0);
    this.position = pos.clone();
    this.baseY = pos.y;

    this.buildCoreVisuals();
  }

  private buildCoreVisuals(): void {
    const suffix = `_${this.coreId}`;

    // 1. Root transform
    this.meshRoot = new BABYLON.TransformNode(`shukaCoreRoot${suffix}`, this.scene);
    this.meshRoot.position = this.position.clone();

    // 2. Ground holographic rune ring (indicates extraction zone on terrain)
    this.groundRing = BABYLON.MeshBuilder.CreateDisc(
      `coreGroundRing${suffix}`,
      {
        radius: this.interactionRadius,
        tessellation: 48
      },
      this.scene
    );
    this.groundRing.rotation.x = Math.PI / 2;
    this.groundRing.position.y = 0.08 - this.baseY; // Ground level
    this.groundRing.parent = this.meshRoot;

    const groundRingMat = new BABYLON.StandardMaterial(`groundRingMat${suffix}`, this.scene);
    groundRingMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    groundRingMat.emissiveColor = new BABYLON.Color3(0.0, 0.6, 0.85);
    groundRingMat.alpha = 0.15;
    groundRingMat.wireframe = true;
    this.groundRing.material = groundRingMat;

    // 3. Rotating Extraction Ring around Core
    this.extractionRing = BABYLON.MeshBuilder.CreateTorus(
      `coreExtractionRing${suffix}`,
      {
        diameter: 2.8,
        thickness: 0.06,
        tessellation: 36
      },
      this.scene
    );
    this.extractionRing.parent = this.meshRoot;

    this.ringMat = new BABYLON.StandardMaterial(`extractionRingMat${suffix}`, this.scene);
    this.ringMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.6);
    this.ringMat.emissiveColor = new BABYLON.Color3(0.0, 0.9, 1.0);
    this.ringMat.alpha = 0.75;
    this.extractionRing.material = this.ringMat;

    // 4. Outer Crystalline Containment Cage (Faceted Polyhedron)
    this.outerCage = BABYLON.MeshBuilder.CreatePolyhedron(
      `coreOuterCage${suffix}`,
      {
        type: 3, // Icosahedron
        size: 0.95
      },
      this.scene
    );
    this.outerCage.parent = this.meshRoot;

    this.cageMat = new BABYLON.StandardMaterial(`coreCageMat${suffix}`, this.scene);
    this.cageMat.wireframe = true;
    this.cageMat.diffuseColor = new BABYLON.Color3(0.2, 0.05, 0.35);
    this.cageMat.emissiveColor = new BABYLON.Color3(0.1, 0.85, 1.0);
    this.cageMat.specularColor = new BABYLON.Color3(0.8, 0.9, 1.0);
    this.cageMat.specularPower = 64;
    this.outerCage.material = this.cageMat;

    // 5. Inner Radiant Energy Plasma Sphere
    this.innerSphere = BABYLON.MeshBuilder.CreateSphere(
      `coreInnerPlasma${suffix}`,
      {
        diameter: 1.15,
        segments: 16
      },
      this.scene
    );
    this.innerSphere.parent = this.meshRoot;

    this.plasmaMat = new BABYLON.StandardMaterial(`corePlasmaMat${suffix}`, this.scene);
    this.plasmaMat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.9);
    this.plasmaMat.emissiveColor = new BABYLON.Color3(0.05, 0.95, 1.0);
    this.plasmaMat.alpha = 0.92;
    this.innerSphere.material = this.plasmaMat;

    // 6. Sky Beacon Pillar (lightweight cylinder for visibility from afar)
    this.beaconPillar = BABYLON.MeshBuilder.CreateCylinder(
      `coreBeaconPillar${suffix}`,
      {
        diameterTop: 0.15,
        diameterBottom: 1.0,
        height: 40,
        tessellation: 12
      },
      this.scene
    );
    this.beaconPillar.position.y = 20;
    this.beaconPillar.parent = this.meshRoot;

    this.beaconMat = new BABYLON.StandardMaterial(`beaconPillarMat${suffix}`, this.scene);
    this.beaconMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    this.beaconMat.emissiveColor = new BABYLON.Color3(0.0, 0.8, 1.0);
    this.beaconMat.alpha = 0.16;
    this.beaconPillar.material = this.beaconMat;

    // 7. Pulsing Point Light
    this.pointLight = new BABYLON.PointLight(`corePointLight${suffix}`, new BABYLON.Vector3(0, 0, 0), this.scene);
    this.pointLight.parent = this.meshRoot;
    this.pointLight.diffuse = new BABYLON.Color3(0.1, 0.9, 1.0);
    this.pointLight.intensity = 1.6;
    this.pointLight.range = 14;

    // 8. Lightweight Particle Effect (energy motes orbiting the core)
    this.setupParticles(suffix);
  }

  private setupParticles(suffix: string): void {
    this.particles = new BABYLON.ParticleSystem(`coreMotes${suffix}`, 24, this.scene);
    this.particles.emitter = this.meshRoot as unknown as BABYLON.AbstractMesh;
    this.particles.particleTexture = new BABYLON.Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAPElEQVQoU2NkYGBg+M/AwPAfk4wMDAwMHAz//4P5iAqwChAVwE3CqgBWATcJs/94FcAo4FWA12dE+RkAqR8R5dYI9i8AAAAASUVORK5CYII=',
      this.scene
    );
    this.particles.color1 = new BABYLON.Color4(0.0, 0.95, 1.0, 0.9);
    this.particles.color2 = new BABYLON.Color4(0.7, 0.2, 1.0, 0.8);
    this.particles.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    this.particles.minSize = 0.2;
    this.particles.maxSize = 0.5;
    this.particles.minLifeTime = 0.8;
    this.particles.maxLifeTime = 1.8;
    this.particles.emitRate = 16;
    this.particles.minEmitBox = new BABYLON.Vector3(-0.6, -0.6, -0.6);
    this.particles.maxEmitBox = new BABYLON.Vector3(0.6, 0.6, 0.6);
    this.particles.minEmitPower = 0.3;
    this.particles.maxEmitPower = 0.8;
    this.particles.direction1 = new BABYLON.Vector3(-0.5, 0.8, -0.5);
    this.particles.direction2 = new BABYLON.Vector3(0.5, 1.2, 0.5);
    this.particles.start();
  }

  /**
   * Update called every frame by GameManager tick
   */
  public update(
    deltaSeconds: number,
    playerPosition: BABYLON.Vector3,
    isExtractActionHeld: boolean
  ): void {
    // Handle cancellation feedback timer
    if (this.showCancelledFeedback) {
      this.cancelledTimer -= deltaSeconds;
      if (this.cancelledTimer <= 0) {
        this.showCancelledFeedback = false;
      }
    }

    // If COLLECTED, core is inert / inactive
    if (this.state === CoreState.COLLECTED) {
      return;
    }

    this.animTime += deltaSeconds;

    // Scan highlight countdown (Phase 11)
    if (this.scanTimer > 0) {
      this.scanTimer -= deltaSeconds;
      if (this.scanTimer <= 0) {
        this.isScanActive = false;
        this.scanTimer = 0;
        if (this.beaconMat) {
          this.beaconMat.alpha = 0.16;
          this.beaconPillar.scaling.x = 1.0;
          this.beaconPillar.scaling.z = 1.0;
        }
      }
    }

    // 1. Proximity Detection
    this.playerDistance = BABYLON.Vector3.Distance(playerPosition, this.meshRoot.position);
    this.isPlayerInRange = this.playerDistance <= this.interactionRadius;

    // 2. Visual Oscillations & Glow with unique variation offsets
    // Subtle vertical floating motion
    const hoverOffset = Math.sin(this.animTime * 2.0 + this.phaseOffset) * 0.22;
    this.meshRoot.position.y = this.baseY + hoverOffset;

    // Rotation
    this.outerCage.rotation.y += deltaSeconds * 1.0 * this.rotationSpeedMultiplier;
    this.outerCage.rotation.x += deltaSeconds * 0.5 * this.rotationSpeedMultiplier;
    this.innerSphere.rotation.y -= deltaSeconds * 0.8 * this.rotationSpeedMultiplier;

    // Pulsing light
    let baseIntensity = 1.6 + Math.sin(this.animTime * 3.5 + this.phaseOffset * 1.5) * 0.35;

    // Scan active visual boost
    if (this.isScanActive) {
      baseIntensity = 4.5 + Math.sin(this.animTime * 12.0) * 1.2;
      if (this.beaconMat) {
        this.beaconMat.alpha = 0.7;
        this.beaconPillar.scaling.x = 1.8;
        this.beaconPillar.scaling.z = 1.8;
      }
    }

    // 3. State Machine & Extraction Flow
    if (this.state === CoreState.AVAILABLE) {
      // Gentle extraction ring spin
      this.extractionRing.rotation.y += deltaSeconds * 0.6;
      this.extractionRing.rotation.z = Math.sin(this.animTime * 1.5 + this.phaseOffset) * 0.1;

      // Check transition to EXTRACTING
      if (this.isPlayerInRange && isExtractActionHeld) {
        this.state = CoreState.EXTRACTING;
        this.showCancelledFeedback = false;
      }
    } else if (this.state === CoreState.EXTRACTING) {
      // Check cancellation conditions
      if (!this.isPlayerInRange) {
        // Player walked away
        this.cancelExtraction('Player moved out of range');
      } else if (!isExtractActionHeld) {
        // Player released extract key
        this.cancelExtraction('Player released extract key');
      } else {
        // Player is holding E within range -> advance extraction
        this.extractionProgress += deltaSeconds / this.extractionDuration;

        // Visual effects while extracting:
        // Stronger glow & faster pulse
        baseIntensity = 3.2 + Math.sin(this.animTime * 8.0 + this.phaseOffset) * 0.8;
        this.plasmaMat.emissiveColor.set(0.2, 1.0, 1.0);
        this.ringMat.emissiveColor.set(0.4, 0.95, 1.0);

        // Fast rotating extraction ring
        this.extractionRing.rotation.y += deltaSeconds * 3.8;
        const ringPulse = 1.0 + Math.sin(this.animTime * 10.0) * 0.05;
        this.extractionRing.scaling.set(ringPulse, ringPulse, ringPulse);

        // Inner sphere energy pulse
        const innerPulse = 1.0 + Math.sin(this.animTime * 6.0) * 0.08;
        this.innerSphere.scaling.setAll(innerPulse);

        // Check completion (100%)
        if (this.extractionProgress >= 1.0) {
          this.collect();
        }
      }
    }

    this.pointLight.intensity = baseIntensity;
  }

  /**
   * Cancels active extraction and immediately resets progress to 0%
   */
  private cancelExtraction(reason: string): void {
    if (this.state === CoreState.EXTRACTING) {
      this.state = CoreState.AVAILABLE;
      this.extractionProgress = 0.0;
      this.showCancelledFeedback = true;
      this.cancelledTimer = 1.5; // Show for 1.5 seconds

      // Reset extraction ring scale & visuals
      this.extractionRing.scaling.setAll(1.0);
      this.innerSphere.scaling.setAll(1.0);
      this.plasmaMat.emissiveColor.set(0.05, 0.95, 1.0);
      this.ringMat.emissiveColor.set(0.0, 0.9, 1.0);
    }
  }

  /**
   * Collects the energy core at 100% extraction:
   * - Disables interaction
   * - Makes core inactive
   * - Stops rotation, pulse, and particles
   * - Emits CORE_COLLECTED event and logs to console
   */
  public collect(): void {
    this.state = CoreState.COLLECTED;
    this.extractionProgress = 1.0;
    this.showCancelledFeedback = false;

    // Stop visuals
    this.meshRoot.setEnabled(false);
    this.pointLight.setEnabled(false);
    this.particles.stop();

    // Audio cue
    this.audioMgr.playCoreCollected();

    // 1. Console log required by specification
    console.log(`[CORE] ${this.name} collected`);

    // 2. Emit Game Event
    const payload: CoreCollectedPayload = {
      coreId: this.coreId,
      world: this.world
    };

    if (this.onCoreCollected) {
      this.onCoreCollected(payload);
    }

    // Also dispatch DOM event for external listeners
    window.dispatchEvent(
      new CustomEvent('CORE_COLLECTED', { detail: payload })
    );
  }

  /**
   * Resets the core to AVAILABLE state for repeatable testing
   */
  public reset(): void {
    this.state = CoreState.AVAILABLE;
    this.extractionProgress = 0.0;
    this.showCancelledFeedback = false;
    this.cancelledTimer = 0;

    // Restore mesh and light
    this.meshRoot.setEnabled(true);
    this.meshRoot.position = this.position.clone();
    this.pointLight.setEnabled(true);
    this.pointLight.intensity = 1.6;
    this.particles.start();

    this.outerCage.scaling.setAll(1.0);
    this.innerSphere.scaling.setAll(1.0);
    this.extractionRing.scaling.setAll(1.0);

    console.log(`[CORE] ${this.name} reset to AVAILABLE`);
  }

  /**
   * Generates ASCII progress bar as requested:
   * e.g., "████░░░░░░ 40%"
   */
  public getAsciiProgressBar(totalSegments: number = 10): string {
    const filledCount = Math.round(this.extractionProgress * totalSegments);
    const filled = '█'.repeat(filledCount);
    const empty = '░'.repeat(Math.max(0, totalSegments - filledCount));
    const pct = Math.round(this.extractionProgress * 100);
    return `${filled}${empty} ${pct}%`;
  }
}
