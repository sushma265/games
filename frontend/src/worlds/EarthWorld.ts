import * as BABYLON from 'babylonjs';

export interface EarthCoreEntity {
  id: string;
  name: string;
  localPos: BABYLON.Vector3;
  worldPos: BABYLON.Vector3;
  rootMesh: BABYLON.TransformNode;
  coreMesh: BABYLON.Mesh;
  rings: BABYLON.Mesh[];
  glowLight: BABYLON.PointLight;
  collected: boolean;
  extracting: boolean;
  pulseTimer: number;
}

/**
 * EarthWorld - Ruined futuristic Earth simulation sector where the Alien AI operates.
 * - Minimal, gameplay-compatible ruined futuristic Earth representation
 * - Isolated at EARTH_OFFSET (320, 0, 0) so it does not collide with Shuka
 * - Contains damaged structures: crashed spacecraft, shattered skyscraper ruins,
 *   collapsed highway overpass, defense depot, ruined energy grid
 * - 5 Earth Energy Cores with amber/crimson glowing containment rings
 * - 3D Alien AI entity with glowing crimson optic, rotating containment rings,
 *   floating "ALIEN AI" nameplate, and a visible extraction beam when extracting
 * - Dedicated Earth Drone Recon Camera toggled via [V] for tactical surveillance
 */
export class EarthWorld {
  public scene: BABYLON.Scene;

  // Spatial isolation offset away from Shuka
  public static readonly EARTH_OFFSET = new BABYLON.Vector3(320, 0, 0);

  // 5 Strategic Earth Energy Core locations across the ruined city sectors
  public static readonly CORE_LOCATIONS: BABYLON.Vector3[] = [
    new BABYLON.Vector3(0, 1.5, 18),      // Sector Alpha: Crashed Spacecraft Plaza
    new BABYLON.Vector3(28, 1.5, 8),      // Sector Beta: Shattered Skyscraper Ruin
    new BABYLON.Vector3(-24, 1.5, 22),    // Sector Gamma: Collapsed Highway Overpass
    new BABYLON.Vector3(20, 1.5, -26),    // Sector Delta: Abandoned Defense Depot
    new BABYLON.Vector3(-28, 1.5, -18)    // Sector Epsilon: Ruined Energy Grid
  ];

  // Core names for tactical telemetry
  public static readonly SECTOR_NAMES: string[] = [
    'CRASH SITE ALPHA',
    'SKYSCRAPER RUIN BETA',
    'HIGHWAY OVERPASS GAMMA',
    'DEFENSE DEPOT DELTA',
    'GRID SUBSTATION EPSILON'
  ];

  public earthCores: EarthCoreEntity[] = [];

  // Alien AI 3D entity components
  public alienRoot: BABYLON.TransformNode;
  public alienBody!: BABYLON.Mesh;
  public alienEye!: BABYLON.Mesh;
  public alienRings: BABYLON.Mesh[] = [];
  public alienLight!: BABYLON.PointLight;
  public alienNameplate!: BABYLON.Mesh;
  public extractionBeam: BABYLON.LinesMesh | null = null;

  // Dedicated Recon Camera
  public earthDroneCam!: BABYLON.ArcRotateCamera;
  public isReconActive: boolean = false;

  // Atmosphere lighting
  private earthSunLight!: BABYLON.DirectionalLight;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.alienRoot = new BABYLON.TransformNode('alienAIRoot', this.scene);
    this.alienRoot.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(0, 1.5, 0));

    this.buildLighting();
    this.buildRuinedEnvironment();
    this.buildEarthCores();
    this.buildAlienMesh();
    this.buildReconCamera();
  }

  /**
   * Contained warm industrial lighting for the ruined Earth sector
   */
  private buildLighting(): void {
    const earthHemiLight = new BABYLON.HemisphericLight(
      'earthHemiLight',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    earthHemiLight.intensity = 1.35;
    earthHemiLight.diffuse = new BABYLON.Color3(0.95, 0.98, 1.0);
    earthHemiLight.groundColor = new BABYLON.Color3(0.45, 0.45, 0.5);

    this.earthSunLight = new BABYLON.DirectionalLight(
      'earthSunLight',
      new BABYLON.Vector3(-0.4, -1, 0.3),
      this.scene
    );
    this.earthSunLight.diffuse = new BABYLON.Color3(1.0, 0.88, 0.75);
    this.earthSunLight.specular = new BABYLON.Color3(0.5, 0.4, 0.3);
    this.earthSunLight.intensity = 1.45;
  }

  /**
   * Builds the ruined futuristic Earth terrain and damaged structures
   */
  private buildRuinedEnvironment(): void {
    // 1. Ruined industrial concrete/asphalt ground
    const ground = BABYLON.MeshBuilder.CreateGround(
      'earthGround',
      { width: 140, height: 140, subdivisions: 16 },
      this.scene
    );
    ground.position = EarthWorld.EARTH_OFFSET.clone();

    const groundMat = new BABYLON.StandardMaterial('earthGroundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.52, 0.55, 0.60);
    groundMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    groundMat.roughness = 0.6;
    ground.material = groundMat;
    ground.checkCollisions = true;

    // 2. Concrete perimeter barrier walls
    const wallMat = new BABYLON.StandardMaterial('earthWallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.18, 0.17, 0.16);

    const perimeter = [
      { x: 0, z: 68, w: 140, d: 4 },
      { x: 0, z: -68, w: 140, d: 4 },
      { x: 68, z: 0, w: 4, d: 140 },
      { x: -68, z: 0, w: 4, d: 140 }
    ];

    perimeter.forEach((p, idx) => {
      const wall = BABYLON.MeshBuilder.CreateBox(`earthPerimeter_${idx}`, { width: p.w, depth: p.d, height: 8 }, this.scene);
      wall.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(p.x, 4, p.z));
      wall.material = wallMat;
    });

    // 3. Damaged futuristic structures
    this.buildDamagedStructures();
  }

  /**
   * Creates landmark structures representing the 5 sectors
   */
  private buildDamagedStructures(): void {
    const rustMat = new BABYLON.StandardMaterial('earthRustMat', this.scene);
    rustMat.diffuseColor = new BABYLON.Color3(0.35, 0.18, 0.12);

    const concreteMat = new BABYLON.StandardMaterial('earthDamagedConcreteMat', this.scene);
    concreteMat.diffuseColor = new BABYLON.Color3(0.24, 0.22, 0.22);

    // Sector Alpha: Crashed Spacecraft Plaza
    const hullDebris = BABYLON.MeshBuilder.CreateCylinder('debrisHull', { diameterTop: 0.5, diameterBottom: 8, height: 14 }, this.scene);
    hullDebris.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(0, 4, 14));
    hullDebris.rotation.x = Math.PI / 3.5;
    hullDebris.rotation.z = Math.PI / 8;
    hullDebris.material = rustMat;

    // Sector Beta: Shattered Skyscraper Ruin (steel lattice columns)
    for (let i = 0; i < 4; i++) {
      const pylon = BABYLON.MeshBuilder.CreateBox(`ruinPylon_${i}`, { width: 1.8, depth: 1.8, height: 16 + i * 3 }, this.scene);
      pylon.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(25 + (i % 2) * 5, 8, 5 + Math.floor(i / 2) * 5));
      pylon.rotation.y = 0.2 * i;
      pylon.material = rustMat;
    }

    // Sector Gamma: Collapsed Highway Overpass (tilted concrete slab)
    const highwayRamp = BABYLON.MeshBuilder.CreateBox('highwayRamp', { width: 9, depth: 24, height: 1.2 }, this.scene);
    highwayRamp.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(-24, 4, 20));
    highwayRamp.rotation.x = -Math.PI / 9;
    highwayRamp.rotation.y = Math.PI / 7;
    highwayRamp.material = concreteMat;

    // Sector Delta: Abandoned Defense Depot (blast bunkers)
    for (let j = 0; j < 3; j++) {
      const bunker = BABYLON.MeshBuilder.CreateBox(`defenseDepot_${j}`, { width: 7, depth: 4, height: 4.5 }, this.scene);
      bunker.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(16 + j * 5, 2.25, -24 - j * 2));
      bunker.rotation.y = 0.3 * j;
      bunker.material = concreteMat;
    }

    // Sector Epsilon: Ruined Energy Grid (high-voltage transformer tanks)
    for (let k = 0; k < 3; k++) {
      const transformer = BABYLON.MeshBuilder.CreateCylinder(`gridTrans_${k}`, { diameter: 3.5, height: 6 }, this.scene);
      transformer.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(-26 - k * 3, 3, -16 - k * 3));
      transformer.material = rustMat;
    }
  }

  /**
   * Instantiates the 5 Earth Energy Cores
   */
  private buildEarthCores(): void {
    this.earthCores = [];

    EarthWorld.CORE_LOCATIONS.forEach((loc, idx) => {
      const coreId = `earth-core-${idx + 1}`;
      const coreName = EarthWorld.SECTOR_NAMES[idx] || `EARTH CORE ${idx + 1}`;
      const worldPos = EarthWorld.EARTH_OFFSET.clone().add(loc);

      const rootNode = new BABYLON.TransformNode(`earthCoreNode_${idx}`, this.scene);
      rootNode.position = worldPos.clone();

      // Industrial containment pedestal
      const pedestal = BABYLON.MeshBuilder.CreateCylinder(`earthPedestal_${idx}`, { diameter: 3.2, height: 0.8 }, this.scene);
      pedestal.parent = rootNode;
      pedestal.position.y = -0.6;
      const pedMat = new BABYLON.StandardMaterial(`earthPedMat_${idx}`, this.scene);
      pedMat.diffuseColor = new BABYLON.Color3(0.2, 0.18, 0.16);
      pedestal.material = pedMat;

      // Central glowing Earth core (octahedron / sphere)
      const coreMesh = BABYLON.MeshBuilder.CreatePolyhedron(`earthCoreMesh_${idx}`, { type: 1, size: 0.9 }, this.scene);
      coreMesh.parent = rootNode;
      coreMesh.position.y = 0.4;

      const coreMat = new BABYLON.StandardMaterial(`earthCoreMat_${idx}`, this.scene);
      coreMat.diffuseColor = new BABYLON.Color3(1.0, 0.45, 0.1);
      coreMat.emissiveColor = new BABYLON.Color3(1.0, 0.35, 0.05);
      coreMat.specularColor = new BABYLON.Color3(1, 0.8, 0.5);
      coreMesh.material = coreMat;

      // Rotating containment rings
      const ring1 = BABYLON.MeshBuilder.CreateTorus(`earthRing1_${idx}`, { diameter: 2.2, thickness: 0.12 }, this.scene);
      ring1.parent = rootNode;
      ring1.position.y = 0.4;
      ring1.rotation.x = Math.PI / 4;

      const ring2 = BABYLON.MeshBuilder.CreateTorus(`earthRing2_${idx}`, { diameter: 2.6, thickness: 0.1 }, this.scene);
      ring2.parent = rootNode;
      ring2.position.y = 0.4;
      ring2.rotation.z = Math.PI / 3;

      const ringMat = new BABYLON.StandardMaterial(`earthRingMat_${idx}`, this.scene);
      ringMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.15);
      ringMat.emissiveColor = new BABYLON.Color3(0.2, 0.1, 0.02);
      ring1.material = ringMat;
      ring2.material = ringMat;

      // Localized point light
      const light = new BABYLON.PointLight(`earthCoreLight_${idx}`, new BABYLON.Vector3(0, 0.6, 0), this.scene);
      light.parent = rootNode;
      light.diffuse = new BABYLON.Color3(1.0, 0.4, 0.1);
      light.intensity = 1.2;
      light.range = 10;

      this.earthCores.push({
        id: coreId,
        name: coreName,
        localPos: loc.clone(),
        worldPos: worldPos,
        rootMesh: rootNode,
        coreMesh,
        rings: [ring1, ring2],
        glowLight: light,
        collected: false,
        extracting: false,
        pulseTimer: idx * 1.3
      });
    });
  }

  /**
   * Constructs the 3D Alien AI entity
   */
  private buildAlienMesh(): void {
    // 1. Central metallic chassis
    this.alienBody = BABYLON.MeshBuilder.CreateSphere('alienChassis', { diameterX: 1.6, diameterY: 1.0, diameterZ: 1.6 }, this.scene);
    this.alienBody.parent = this.alienRoot;
    this.alienBody.position.y = 0.2;

    const alienMat = new BABYLON.StandardMaterial('alienBodyMat', this.scene);
    alienMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);
    alienMat.specularColor = new BABYLON.Color3(0.4, 0.1, 0.15);
    alienMat.roughness = 0.3;
    this.alienBody.material = alienMat;

    // 2. Crimson central optic eye
    this.alienEye = BABYLON.MeshBuilder.CreateSphere('alienEye', { diameter: 0.6 }, this.scene);
    this.alienEye.parent = this.alienRoot;
    this.alienEye.position = new BABYLON.Vector3(0, 0.2, 0.7);

    const eyeMat = new BABYLON.StandardMaterial('alienEyeMat', this.scene);
    eyeMat.diffuseColor = new BABYLON.Color3(1.0, 0.05, 0.1);
    eyeMat.emissiveColor = new BABYLON.Color3(1.0, 0.08, 0.15);
    this.alienEye.material = eyeMat;

    // 3. Orbiting alien levitation rings
    const ringA = BABYLON.MeshBuilder.CreateTorus('alienRingA', { diameter: 2.3, thickness: 0.09 }, this.scene);
    ringA.parent = this.alienRoot;
    ringA.rotation.x = Math.PI / 6;

    const ringB = BABYLON.MeshBuilder.CreateTorus('alienRingB', { diameter: 2.7, thickness: 0.08 }, this.scene);
    ringB.parent = this.alienRoot;
    ringB.rotation.z = -Math.PI / 5;

    const ringMat = new BABYLON.StandardMaterial('alienRingMat', this.scene);
    ringMat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.15);
    ringMat.emissiveColor = new BABYLON.Color3(0.4, 0.05, 0.08);
    ringA.material = ringMat;
    ringB.material = ringMat;
    this.alienRings = [ringA, ringB];

    // 4. Point light attached to Alien
    this.alienLight = new BABYLON.PointLight('alienGlow', new BABYLON.Vector3(0, 0.5, 0), this.scene);
    this.alienLight.parent = this.alienRoot;
    this.alienLight.diffuse = new BABYLON.Color3(1.0, 0.1, 0.2);
    this.alienLight.intensity = 1.4;
    this.alienLight.range = 8;

    // 5. Overhead 3D billboard nameplate: "ALIEN AI"
    this.alienNameplate = BABYLON.MeshBuilder.CreatePlane('alienNameplate', { width: 3.2, height: 0.8 }, this.scene);
    this.alienNameplate.parent = this.alienRoot;
    this.alienNameplate.position.y = 1.8;
    this.alienNameplate.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const tex = new BABYLON.DynamicTexture('alienNameplateTex', { width: 512, height: 128 }, this.scene, false);
    tex.hasAlpha = true;
    tex.drawText('ALIEN AI', null, 80, 'bold 44px monospace', '#ff2244', '#110000cc', true);

    const nameMat = new BABYLON.StandardMaterial('alienNameMat', this.scene);
    nameMat.diffuseTexture = tex;
    nameMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    nameMat.backFaceCulling = false;
    this.alienNameplate.material = nameMat;
  }

  /**
   * Builds the tactical Earth Drone Recon Camera for operatives to observe the Alien race
   */
  private buildReconCamera(): void {
    this.earthDroneCam = new BABYLON.ArcRotateCamera(
      'earthDroneCam',
      -Math.PI / 4,
      Math.PI / 3.2,
      28,
      this.alienRoot.position,
      this.scene
    );
    this.earthDroneCam.lowerRadiusLimit = 12;
    this.earthDroneCam.upperRadiusLimit = 65;
    this.earthDroneCam.upperBetaLimit = Math.PI / 2.1;
  }

  // Disruption effect state (Phase 11)
  private empDisruptionTimer: number = 0;
  private overchargeDisruptionTimer: number = 0;

  public triggerEMPDisruption(duration: number = 5.0): void {
    this.empDisruptionTimer = duration;
  }

  public triggerOverchargeDisruption(duration: number = 2.0): void {
    this.overchargeDisruptionTimer = duration;
  }

  /**
   * Updates Alien AI position, rotation, energy rings, and extraction beam
   */
  public update(
    deltaSeconds: number,
    alienData: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      state: string;
      targetCoreId: string | null;
      extractionProgress: number;
      empActive?: boolean;
      overchargeActive?: boolean;
    }
  ): void {
    // Tick disruption visual timers
    if (this.empDisruptionTimer > 0) {
      this.empDisruptionTimer = Math.max(0, this.empDisruptionTimer - deltaSeconds);
    }
    if (this.overchargeDisruptionTimer > 0) {
      this.overchargeDisruptionTimer = Math.max(0, this.overchargeDisruptionTimer - deltaSeconds);
    }

    const isEMP = !!(alienData.empActive || this.empDisruptionTimer > 0);
    const isOvercharge = !!(alienData.overchargeActive || this.overchargeDisruptionTimer > 0);

    // Visual lighting reaction for EMP & Overcharge
    if (this.alienLight) {
      if (isEMP) {
        // Electric cyan flicker
        const flicker = 1.8 + Math.sin(Date.now() * 0.05) * 0.8;
        this.alienLight.diffuse = new BABYLON.Color3(0.1, 0.9, 1.0);
        this.alienLight.intensity = flicker;
      } else if (isOvercharge) {
        // High-energy gold-amber shock
        const flash = 2.4 + Math.sin(Date.now() * 0.08) * 1.2;
        this.alienLight.diffuse = new BABYLON.Color3(1.0, 0.7, 0.1);
        this.alienLight.intensity = flash;
      } else {
        // Standard ominous crimson glow
        this.alienLight.diffuse = new BABYLON.Color3(1.0, 0.1, 0.2);
        this.alienLight.intensity = 1.4;
      }
    }

    // 1. Position alien in Earth space
    const targetWorldPos = EarthWorld.EARTH_OFFSET.clone().add(
      new BABYLON.Vector3(alienData.position.x, alienData.position.y, alienData.position.z)
    );

    // Smooth hover interpolation (with slight jitter if disrupted)
    const jitter = isOvercharge ? (Math.random() - 0.5) * 0.15 : 0;
    this.alienRoot.position = BABYLON.Vector3.Lerp(
      this.alienRoot.position,
      targetWorldPos.add(new BABYLON.Vector3(jitter, jitter, jitter)),
      Math.min(1.0, deltaSeconds * 12)
    );
    this.alienRoot.rotation.y = BABYLON.Scalar.Lerp(this.alienRoot.rotation.y, alienData.rotation.y, Math.min(1.0, deltaSeconds * 10));

    // Animate levitation rings (slowed/reversed if EMP)
    const ringSpeedMult = isEMP ? -0.5 : 1.0;
    if (this.alienRings[0]) this.alienRings[0].rotation.y += deltaSeconds * 2.5 * ringSpeedMult;
    if (this.alienRings[1]) this.alienRings[1].rotation.x += deltaSeconds * 1.8 * ringSpeedMult;

    // Update recon camera target
    this.earthDroneCam.target = this.alienRoot.position;

    // 2. Animate Earth Cores
    this.earthCores.forEach((core) => {
      core.pulseTimer += deltaSeconds;

      if (!core.collected) {
        core.rings[0].rotation.y += deltaSeconds * 1.5;
        core.rings[1].rotation.x += deltaSeconds * 1.2;
        core.coreMesh.rotation.y += deltaSeconds * 0.8;

        if (core.extracting) {
          // Intense pulse when being extracted
          const intensity = 1.5 + Math.sin(core.pulseTimer * 12) * 0.8;
          core.glowLight.intensity = intensity;
        } else {
          core.glowLight.intensity = 1.0 + Math.sin(core.pulseTimer * 3) * 0.3;
        }
      } else {
        // Collected: extinguished core
        core.glowLight.intensity = 0.1;
      }
    });

    // 3. Render Extraction Beam when state is EXTRACTING
    if (alienData.state === 'EXTRACTING' && alienData.targetCoreId) {
      const targetCore = this.earthCores.find((c) => c.id === alienData.targetCoreId);
      if (targetCore && !targetCore.collected) {
        targetCore.extracting = true;
        this.renderExtractionBeam(this.alienRoot.position, targetCore.worldPos);
      } else {
        this.clearExtractionBeam();
      }
    } else {
      this.clearExtractionBeam();
      this.earthCores.forEach((c) => {
        if (!c.collected) c.extracting = false;
      });
    }
  }

  /**
   * Renders dynamic energy extraction beam between Alien AI and targeted Earth Core
   */
  private renderExtractionBeam(start: BABYLON.Vector3, end: BABYLON.Vector3): void {
    if (this.extractionBeam) {
      this.extractionBeam.dispose();
      this.extractionBeam = null;
    }

    const points: BABYLON.Vector3[] = [
      start.clone().add(new BABYLON.Vector3(0, 0.2, 0)),
      end.clone().add(new BABYLON.Vector3(0, 0.4, 0))
    ];

    this.extractionBeam = BABYLON.MeshBuilder.CreateLines(
      'alienExtractionBeam',
      { points, updatable: true },
      this.scene
    );
    this.extractionBeam.color = new BABYLON.Color3(1.0, 0.15, 0.25);
  }

  private clearExtractionBeam(): void {
    if (this.extractionBeam) {
      this.extractionBeam.dispose();
      this.extractionBeam = null;
    }
  }

  /**
   * Marks core collected on Earth
   */
  public setCoreCollected(coreId: string, collected: boolean = true): void {
    const core = this.earthCores.find((c) => c.id === coreId);
    if (!core) return;

    core.collected = collected;
    core.extracting = false;

    if (collected) {
      // Turn core dark/depleted
      const darkMat = new BABYLON.StandardMaterial(`darkMat_${core.id}`, this.scene);
      darkMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.08);
      darkMat.emissiveColor = new BABYLON.Color3(0.04, 0.02, 0.02);
      core.coreMesh.material = darkMat;
      core.glowLight.intensity = 0.05;
    }
  }

  /**
   * Toggles active camera between primary player camera and Earth Recon Drone Camera
   */
  public toggleReconCamera(active?: boolean): boolean {
    if (typeof active === 'boolean') {
      this.isReconActive = active;
    } else {
      this.isReconActive = !this.isReconActive;
    }

    if (this.isReconActive) {
      this.scene.activeCamera = this.earthDroneCam;
      this.earthDroneCam.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    }

    return this.isReconActive;
  }

  /**
   * Resets Earth sector cores and Alien mesh
   */
  public reset(): void {
    this.clearExtractionBeam();
    this.earthCores.forEach((c, idx) => {
      c.collected = false;
      c.extracting = false;
      const coreMat = new BABYLON.StandardMaterial(`earthCoreMat_${idx}`, this.scene);
      coreMat.diffuseColor = new BABYLON.Color3(1.0, 0.45, 0.1);
      coreMat.emissiveColor = new BABYLON.Color3(1.0, 0.35, 0.05);
      c.coreMesh.material = coreMat;
      c.glowLight.intensity = 1.2;
    });

    this.alienRoot.position = EarthWorld.EARTH_OFFSET.clone().add(new BABYLON.Vector3(0, 1.5, 0));
  }
}
