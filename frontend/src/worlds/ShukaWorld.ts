import * as BABYLON from 'babylonjs';

/**
 * ShukaWorld - Alien Anti-Gravity Crystalline World
 * - Visibly floating archipelago suspended high above a pastel cloud layer.
 * - Central Shuka Sanctuary Hub + 5 Major Floating Core Islands matching CORE_LOCATIONS.
 * - Tapering 3D rocky cone undersides with bioluminescent crystal cores and structural struts.
 * - Pastel pink/purple/cyan palette matching Reference Image 2.
 * - Floating crystal stepping-stones & bridges connecting islands over open sky.
 * - Dynamic bobbing floating crystal shards and atmospheric sky depth.
 */
export class ShukaWorld {
  private scene: BABYLON.Scene;
  public groundMesh!: BABYLON.Mesh;
  private floatingRocks: BABYLON.Mesh[] = [];
  private floatingRockBaseY: number[] = [];
  private floatingRockSpeeds: number[] = [];
  private portalRing!: BABYLON.Mesh;
  private time: number = 0;

  // 5 Strategic Energy Core coordinates across Shuka's distinct sectors
  public static readonly CORE_LOCATIONS: BABYLON.Vector3[] = [
    new BABYLON.Vector3(0, 1.8, 22),     // Sector 1: The Basalt Gateway
    new BABYLON.Vector3(38, 2.2, 12),    // Sector 2: Crystal Spires Ridge
    new BABYLON.Vector3(-32, 2.0, 30),   // Sector 3: The Monolith Shrine
    new BABYLON.Vector3(26, 2.5, -34),   // Sector 4: Xenolith Basin
    new BABYLON.Vector3(-36, 2.2, -26)   // Sector 5: Ancient Portal Ruins
  ];

  // Alien Harvester/Sentinel units modeled on Shuka World
  public alienSentinelNodes: BABYLON.TransformNode[] = [];
  public alienRingsList: BABYLON.Mesh[][] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.setupAtmosphere();
    this.buildFloatingArchipelago();
    this.buildAncientRuins();
    this.buildCrystallineFormations();
    this.buildFloatingDebris();
    this.buildBioluminescentFlora();
    this.buildAncientPortal();
    this.buildAlienHarvesterEntities();
  }

  private setupAtmosphere(): void {
    // Pastel Dreamlike Alien Atmosphere matching Reference Image 2
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogColor = new BABYLON.Color3(0.85, 0.75, 0.92); // Soft pastel purple-pink haze
    this.scene.fogDensity = 0.003;

    this.scene.clearColor = new BABYLON.Color4(0.78, 0.85, 0.98, 1.0); // Soft cyan sky

    // High-visibility bright ambient & directional lighting
    const hemiLight = new BABYLON.HemisphericLight('shukaHemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 1.4;
    hemiLight.groundColor = new BABYLON.Color3(0.65, 0.45, 0.75); // Deep magenta underglow
    hemiLight.diffuse = new BABYLON.Color3(0.9, 0.92, 1.0); // Soft pastel sky fill

    const dirLight = new BABYLON.DirectionalLight('shukaSun', new BABYLON.Vector3(-0.5, -1, 0.3), this.scene);
    dirLight.intensity = 1.35;
    dirLight.diffuse = new BABYLON.Color3(1.0, 0.92, 0.88); // Warm pastel beam

    // Distant Cloud Layer far below the floating islands (y: -70)
    const cloudPlane = BABYLON.MeshBuilder.CreatePlane('shukaBottomClouds', { size: 600 }, this.scene);
    cloudPlane.position.y = -70;
    cloudPlane.rotation.x = Math.PI / 2;
    const cloudMat = new BABYLON.StandardMaterial('shukaCloudMat', this.scene);
    cloudMat.diffuseColor = new BABYLON.Color3(0.88, 0.78, 0.92);
    cloudMat.emissiveColor = new BABYLON.Color3(0.45, 0.35, 0.55);
    cloudMat.alpha = 0.85;
    cloudPlane.material = cloudMat;
  }

  /**
   * Constructs the 3D Anti-Gravity Floating Archipelago consisting of:
   * 1. Central Shuka Sanctuary Hub Island
   * 2. 5 Major Floating Core Islands for the 5 Shuka Energy Cores
   * 3. Stepping stone bridges over open sky gaps
   */
  private buildFloatingArchipelago(): void {
    // Pastel materials matching Reference Image 2
    const greenTopMat = new BABYLON.StandardMaterial('shukaGreenTopMat', this.scene);
    greenTopMat.diffuseColor = new BABYLON.Color3(0.6, 0.88, 0.72); // Pastel mint green top grass
    greenTopMat.specularColor = new BABYLON.Color3(0.2, 0.3, 0.25);

    const purpleTopMat = new BABYLON.StandardMaterial('shukaPurpleTopMat', this.scene);
    purpleTopMat.diffuseColor = new BABYLON.Color3(0.82, 0.65, 0.9); // Pastel lavender top turf

    const rockUndersideMat = new BABYLON.StandardMaterial('shukaRockUndersideMat', this.scene);
    rockUndersideMat.diffuseColor = new BABYLON.Color3(0.42, 0.45, 0.6); // Slate violet rock
    rockUndersideMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.35);

    const crystalGlowMat = new BABYLON.StandardMaterial('shukaEngineCrystalMat', this.scene);
    crystalGlowMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    crystalGlowMat.emissiveColor = new BABYLON.Color3(0.85, 0.25, 0.95); // Glowing magenta crystal underglow

    // 1. Central Shuka Sanctuary Hub
    const centralPos = new BABYLON.Vector3(0, 0, 0);
    this.groundMesh = this.createAntiGravIsland(
      'shukaCentralHub',
      centralPos,
      44,
      44,
      2.5,
      16,
      greenTopMat,
      rockUndersideMat,
      crystalGlowMat
    );

    // Decorative inner purple turf ring on central hub
    const innerRing = BABYLON.MeshBuilder.CreateCylinder('shukaHubInnerRing', { diameter: 28, height: 0.2 }, this.scene);
    innerRing.position = new BABYLON.Vector3(0, 1.35, 0);
    innerRing.material = purpleTopMat;

    // 2. 5 Major Floating Core Islands for the 5 Shuka Energy Cores
    ShukaWorld.CORE_LOCATIONS.forEach((loc, idx) => {
      const islandName = `shukaCoreIsland_${idx}`;
      const topMat = idx % 2 === 0 ? greenTopMat : purpleTopMat;

      // Heights slightly varied to create 3D Z/Y elevation depth
      const islandPos = new BABYLON.Vector3(loc.x, loc.y - 1.8, loc.z);
      this.createAntiGravIsland(islandName, islandPos, 22, 22, 2.0, 12, topMat, rockUndersideMat, crystalGlowMat);

      // Create floating stepping stone bridges between central hub and this core island
      this.buildSteppingStoneBridge(centralPos, islandPos, topMat, rockUndersideMat);
    });
  }

  /**
   * Creates an individual 3D Anti-Gravity Floating Island with top deck, cliff sides,
   * tapering 3D rocky underside cone, glowing crystal engine tip, and support struts.
   */
  private createAntiGravIsland(
    name: string,
    position: BABYLON.Vector3,
    width: number,
    depth: number,
    deckHeight: number,
    undersideDepth: number,
    deckMat: BABYLON.Material,
    undersideMat: BABYLON.Material,
    crystalGlowMat: BABYLON.Material
  ): BABYLON.Mesh {
    const root = new BABYLON.TransformNode(`root_${name}`, this.scene);
    root.position = position.clone();

    // Top Playable Surface Deck
    const deck = BABYLON.MeshBuilder.CreateBox(`${name}_deck`, { width, depth, height: deckHeight }, this.scene);
    deck.position = new BABYLON.Vector3(0, 0, 0);
    deck.material = deckMat;
    deck.checkCollisions = true;
    deck.parent = root;

    // Tapering 3D Inverted Rocky Underside Cone
    const underside = BABYLON.MeshBuilder.CreateCylinder(`${name}_underside`, {
      diameterTop: Math.min(width, depth) * 0.9,
      diameterBottom: 2.8,
      height: undersideDepth,
      tessellation: 7
    }, this.scene);
    underside.position = new BABYLON.Vector3(0, -(deckHeight / 2 + undersideDepth / 2), 0);
    underside.material = undersideMat;
    underside.parent = root;

    // Bioluminescent Glowing Crystal Core tip at bottom of underside
    const engineCore = BABYLON.MeshBuilder.CreatePolyhedron(`${name}_crystalCore`, { type: 1, size: 2.2 }, this.scene);
    engineCore.position = new BABYLON.Vector3(0, -(deckHeight / 2 + undersideDepth), 0);
    engineCore.material = crystalGlowMat;
    engineCore.parent = root;

    // Point Light for bioluminescent underglow
    const glowLight = new BABYLON.PointLight(`${name}_underglow`, new BABYLON.Vector3(0, -1, 0), this.scene);
    glowLight.diffuse = new BABYLON.Color3(0.85, 0.25, 0.95);
    glowLight.intensity = 0.9;
    glowLight.range = 14;
    glowLight.parent = engineCore;

    // 4 Structural Rocky Struts extending from deck edges down to the bottom crystal tip
    const strutStarts = [
      new BABYLON.Vector3(-width * 0.35, -deckHeight / 2, -depth * 0.35),
      new BABYLON.Vector3(width * 0.35, -deckHeight / 2, -depth * 0.35),
      new BABYLON.Vector3(-width * 0.35, -deckHeight / 2, depth * 0.35),
      new BABYLON.Vector3(width * 0.35, -deckHeight / 2, depth * 0.35)
    ];

    strutStarts.forEach((start, i) => {
      const end = engineCore.position.clone();
      const dist = BABYLON.Vector3.Distance(start, end);
      const strut = BABYLON.MeshBuilder.CreateCylinder(`${name}_rockStrut_${i}`, { diameter: 0.9, height: dist, tessellation: 5 }, this.scene);
      strut.position = BABYLON.Vector3.Center(start, end);
      strut.lookAt(end);
      strut.rotation.x += Math.PI / 2;
      strut.material = undersideMat;
      strut.parent = root;
    });

    return deck;
  }

  /**
   * Builds a series of floating stepping-stone rock platforms connecting two islands over open sky.
   */
  private buildSteppingStoneBridge(
    from: BABYLON.Vector3,
    to: BABYLON.Vector3,
    topMat: BABYLON.Material,
    rockMat: BABYLON.Material
  ): void {
    const distance = BABYLON.Vector3.Distance(from, to);
    const steps = Math.floor(distance / 7.5);
    if (steps <= 1) return;

    const dir = to.subtract(from).normalize();

    for (let i = 1; i < steps; i++) {
      const ratio = i / steps;
      const stepPos = BABYLON.Vector3.Lerp(from, to, ratio);
      // Slight vertical arc & horizontal offset for natural floating path
      stepPos.y += Math.sin(ratio * Math.PI) * 1.2;
      stepPos.x += Math.sin(i * 2.5) * 1.0;

      const platform = BABYLON.MeshBuilder.CreateBox(`steppingStone_${i}`, {
        width: 3.8,
        depth: 3.8,
        height: 1.0
      }, this.scene);
      platform.position = stepPos;
      platform.material = topMat;
      platform.checkCollisions = true;

      // Small tapering underside cone for stepping stone
      const stoneUnderside = BABYLON.MeshBuilder.CreateCylinder(`stoneUnderside_${i}`, {
        diameterTop: 3.4,
        diameterBottom: 0.8,
        height: 2.2,
        tessellation: 5
      }, this.scene);
      stoneUnderside.position = stepPos.clone().subtract(new BABYLON.Vector3(0, 1.6, 0));
      stoneUnderside.material = rockMat;
    }
  }

  private buildAncientRuins(): void {
    const ruinMat = new BABYLON.StandardMaterial('shukaRuinMat', this.scene);
    ruinMat.diffuseColor = new BABYLON.Color3(0.55, 0.58, 0.68);
    ruinMat.specularColor = new BABYLON.Color3(0.2, 0.1, 0.3);

    const glyphMat = new BABYLON.StandardMaterial('shukaGlyphMat', this.scene);
    glyphMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    glyphMat.emissiveColor = new BABYLON.Color3(0.75, 0.2, 0.95); // Bright violet glyph glow

    // Central Monolith Pillar Array
    const pillarPositions = [
      new BABYLON.Vector3(-12, 0, 16),
      new BABYLON.Vector3(12, 0, 16),
      new BABYLON.Vector3(-14, 0, 26),
      new BABYLON.Vector3(14, 0, 26),
      new BABYLON.Vector3(-28, 0, 28),
      new BABYLON.Vector3(-36, 0, 32),
      new BABYLON.Vector3(34, 0, 18),
      new BABYLON.Vector3(42, 0, 8),
      new BABYLON.Vector3(22, 0, -30),
      new BABYLON.Vector3(30, 0, -38),
    ];

    pillarPositions.forEach((pos, idx) => {
      const height = 6 + (idx % 3) * 3;
      const pillar = BABYLON.MeshBuilder.CreateBox(`pillar_${idx}`, {
        width: 1.4,
        height,
        depth: 1.4
      }, this.scene);
      pillar.position = pos.clone();
      pillar.position.y = height / 2 + 0.5;
      pillar.rotation.y = (idx * 0.4);
      pillar.material = ruinMat;

      // Glowing alien glyph strip
      const glyph = BABYLON.MeshBuilder.CreateBox(`glyph_${idx}`, {
        width: 1.42,
        height: 0.35,
        depth: 1.42
      }, this.scene);
      glyph.position = pillar.position.clone();
      glyph.position.y = height * 0.7;
      glyph.material = glyphMat;
    });

    // Elevated Temple Platform near Core 5
    const templeBase = BABYLON.MeshBuilder.CreateCylinder('templeBase', {
      diameter: 16,
      height: 1.5,
      tessellation: 8
    }, this.scene);
    templeBase.position = new BABYLON.Vector3(-36, 1.5, -26);
    templeBase.material = ruinMat;
  }

  private buildCrystallineFormations(): void {
    const crystalCyanMat = new BABYLON.StandardMaterial('crystalCyanMat', this.scene);
    crystalCyanMat.diffuseColor = new BABYLON.Color3(0, 0.3, 0.4);
    crystalCyanMat.emissiveColor = new BABYLON.Color3(0.0, 0.85, 0.95);
    crystalCyanMat.alpha = 0.85;

    const crystalVioletMat = new BABYLON.StandardMaterial('crystalVioletMat', this.scene);
    crystalVioletMat.diffuseColor = new BABYLON.Color3(0.3, 0.05, 0.4);
    crystalVioletMat.emissiveColor = new BABYLON.Color3(0.85, 0.2, 0.95);
    crystalVioletMat.alpha = 0.85;

    // Create clusters of crystalline spires on core islands
    const clusterCenters = [
      new BABYLON.Vector3(38, 0.5, 12),
      new BABYLON.Vector3(-32, 0.5, 30),
      new BABYLON.Vector3(26, 0.5, -34),
      new BABYLON.Vector3(-18, 0.5, -15),
      new BABYLON.Vector3(15, 0.5, 35)
    ];

    clusterCenters.forEach((center, cIdx) => {
      const shardsCount = 6;
      for (let s = 0; s < shardsCount; s++) {
        const height = 3.0 + Math.random() * 4.5;
        const width = 0.6 + Math.random() * 0.6;
        const crystal = BABYLON.MeshBuilder.CreateCylinder(`crystal_${cIdx}_${s}`, {
          diameterTop: 0.05,
          diameterBottom: width,
          height,
          tessellation: 5
        }, this.scene);

        const angle = (s / shardsCount) * Math.PI * 2;
        const rad = 1.5 + Math.random() * 2.5;
        crystal.position = new BABYLON.Vector3(
          center.x + Math.cos(angle) * rad,
          center.y + height / 2,
          center.z + Math.sin(angle) * rad
        );
        crystal.rotation.x = (Math.random() - 0.5) * 0.4;
        crystal.rotation.z = (Math.random() - 0.5) * 0.4;
        crystal.rotation.y = Math.random() * Math.PI;
        crystal.material = (s % 2 === 0) ? crystalCyanMat : crystalVioletMat;
      }
    });
  }

  private buildFloatingDebris(): void {
    const rockMat = new BABYLON.StandardMaterial('floatingRockMat', this.scene);
    rockMat.diffuseColor = new BABYLON.Color3(0.35, 0.32, 0.45);
    rockMat.specularColor = new BABYLON.Color3(0.3, 0.2, 0.4);

    const crystalGlowMat = new BABYLON.StandardMaterial('floatingCrystalGlow', this.scene);
    crystalGlowMat.emissiveColor = new BABYLON.Color3(0.7, 0.3, 0.95);

    const islandPositions = [
      new BABYLON.Vector3(0, 14, 25),
      new BABYLON.Vector3(45, 12, 20),
      new BABYLON.Vector3(-40, 15, 35),
      new BABYLON.Vector3(30, 18, -40),
      new BABYLON.Vector3(-45, 16, -30),
      new BABYLON.Vector3(0, 20, -20),
    ];

    islandPositions.forEach((pos, idx) => {
      // Create floating asteroid rocks with crystal shards
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`floatRock_${idx}`, {
        type: 1, // Dodecahedron
        size: 3.0 + (idx % 3) * 1.2
      }, this.scene);
      rock.position = pos.clone();
      rock.material = (idx % 2 === 0) ? rockMat : crystalGlowMat;

      this.floatingRocks.push(rock);
      this.floatingRockBaseY.push(pos.y);
      this.floatingRockSpeeds.push(0.6 + Math.random() * 0.8);
    });
  }

  private buildBioluminescentFlora(): void {
    const plantStemMat = new BABYLON.StandardMaterial('plantStemMat', this.scene);
    plantStemMat.diffuseColor = new BABYLON.Color3(0.12, 0.08, 0.18);

    const sporeMat = new BABYLON.StandardMaterial('sporeGlowMat', this.scene);
    sporeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    sporeMat.emissiveColor = new BABYLON.Color3(0.0, 0.95, 0.7); // Bioluminescent aqua

    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const dist = 12 + (i % 7) * 8;
      const x = Math.cos(angle) * dist + (Math.sin(i) * 5);
      const z = Math.sin(angle) * dist + (Math.cos(i) * 5);

      const stem = BABYLON.MeshBuilder.CreateCylinder(`stem_${i}`, {
        diameterTop: 0.1,
        diameterBottom: 0.35,
        height: 2.2,
        tessellation: 6
      }, this.scene);
      stem.position = new BABYLON.Vector3(x, 1.1, z);
      stem.rotation.z = (Math.sin(i) * 0.2);
      stem.material = plantStemMat;

      const spore = BABYLON.MeshBuilder.CreateSphere(`spore_${i}`, {
        diameter: 0.45,
        segments: 8
      }, this.scene);
      spore.position = new BABYLON.Vector3(x, 2.2, z);
      spore.material = sporeMat;
    }
  }

  private buildAncientPortal(): void {
    // Portal arch near Sector 5
    const archMat = new BABYLON.StandardMaterial('portalArchMat', this.scene);
    archMat.diffuseColor = new BABYLON.Color3(0.2, 0.15, 0.28);

    const ring = BABYLON.MeshBuilder.CreateTorus('portalRing', {
      diameter: 12,
      thickness: 1.2,
      tessellation: 24
    }, this.scene);
    ring.position = new BABYLON.Vector3(-36, 7.5, -26);
    ring.rotation.x = Math.PI / 2;
    ring.material = archMat;

    // Swirling energy vortex inside portal
    const vortexMat = new BABYLON.StandardMaterial('vortexMat', this.scene);
    vortexMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    vortexMat.emissiveColor = new BABYLON.Color3(0.65, 0.15, 0.95);
    vortexMat.alpha = 0.65;

    const vortex = BABYLON.MeshBuilder.CreateDisc('portalVortex', {
      radius: 5.4,
      tessellation: 24
    }, this.scene);
    vortex.position = ring.position.clone();
    vortex.material = vortexMat;

    this.portalRing = ring;
  }

  /**
   * Models 3D Alien Harvester / Sentinel entities stationed across Shuka World
   */
  private buildAlienHarvesterEntities(): void {
    const alienChassisMat = new BABYLON.StandardMaterial('shukaAlienChassis', this.scene);
    alienChassisMat.diffuseColor = new BABYLON.Color3(0.12, 0.06, 0.2);
    alienChassisMat.specularColor = new BABYLON.Color3(0.5, 0.2, 0.7);

    const alienMagentaOpticMat = new BABYLON.StandardMaterial('shukaAlienOptic', this.scene);
    alienMagentaOpticMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    alienMagentaOpticMat.emissiveColor = new BABYLON.Color3(0.95, 0.15, 0.85);

    const alienRuneRingMat = new BABYLON.StandardMaterial('shukaAlienRings', this.scene);
    alienRuneRingMat.diffuseColor = new BABYLON.Color3(0.3, 0.1, 0.4);
    alienRuneRingMat.emissiveColor = new BABYLON.Color3(0.7, 0.2, 0.9);

    const sentinelConfigs = [
      { name: 'ALIEN SENTINEL Xeno-1', pos: new BABYLON.Vector3(0, 3.2, 18) },
      { name: 'ALIEN HARVESTER Crystal-2', pos: new BABYLON.Vector3(34, 3.5, 8) },
      { name: 'ALIEN COLLECTOR Void-3', pos: new BABYLON.Vector3(-28, 3.2, 26) }
    ];

    sentinelConfigs.forEach((config, idx) => {
      const root = new BABYLON.TransformNode(`shukaAlienSentinel_${idx}`, this.scene);
      root.position = config.pos.clone();

      // Crystalline Octahedron Body
      const body = BABYLON.MeshBuilder.CreatePolyhedron(`sentinelBody_${idx}`, { type: 1, size: 1.1 }, this.scene);
      body.position.y = 0.5;
      body.material = alienChassisMat;
      body.parent = root;

      // Central glowing magenta optic eye
      const eye = BABYLON.MeshBuilder.CreateSphere(`sentinelEye_${idx}`, { diameter: 0.55 }, this.scene);
      eye.position = new BABYLON.Vector3(0, 0.5, 0.7);
      eye.material = alienMagentaOpticMat;
      eye.parent = root;

      // Orbiting levitation energy rings
      const ring1 = BABYLON.MeshBuilder.CreateTorus(`sentinelRing1_${idx}`, { diameter: 2.2, thickness: 0.08 }, this.scene);
      ring1.position.y = 0.5;
      ring1.rotation.x = Math.PI / 4;
      ring1.material = alienRuneRingMat;
      ring1.parent = root;

      const ring2 = BABYLON.MeshBuilder.CreateTorus(`sentinelRing2_${idx}`, { diameter: 2.6, thickness: 0.07 }, this.scene);
      ring2.position.y = 0.5;
      ring2.rotation.z = Math.PI / 3;
      ring2.material = alienRuneRingMat;
      ring2.parent = root;

      // Extraction Mechanical Appendages (3 floating claws)
      for (let c = 0; c < 3; c++) {
        const angle = (c / 3) * Math.PI * 2;
        const claw = BABYLON.MeshBuilder.CreateCylinder(`sentinelClaw_${idx}_${c}`, { diameterTop: 0.06, diameterBottom: 0.2, height: 1.4 }, this.scene);
        claw.position = new BABYLON.Vector3(Math.cos(angle) * 0.7, -0.4, Math.sin(angle) * 0.7);
        claw.rotation.z = (Math.random() - 0.5) * 0.3;
        claw.material = alienChassisMat;
        claw.parent = root;
      }

      // Overhead 3D Dynamic Nameplate
      const nameplate = BABYLON.MeshBuilder.CreatePlane(`sentinelTag_${idx}`, { width: 3.2, height: 0.7 }, this.scene);
      nameplate.position.y = 2.2;
      nameplate.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      nameplate.parent = root;

      const tex = new BABYLON.DynamicTexture(`sentinelTagTex_${idx}`, { width: 512, height: 128 }, this.scene, false);
      tex.hasAlpha = true;
      tex.drawText(config.name.toUpperCase(), null, 75, 'bold 30px monospace', '#ff00ea', '#260020dd', true);

      const tagMat = new BABYLON.StandardMaterial(`sentinelTagMat_${idx}`, this.scene);
      tagMat.diffuseTexture = tex;
      tagMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      tagMat.backFaceCulling = false;
      nameplate.material = tagMat;

      this.alienSentinelNodes.push(root);
      this.alienRingsList.push([ring1, ring2]);
    });
  }

  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    // Animate floating rocks anti-gravity bobbing
    for (let i = 0; i < this.floatingRocks.length; i++) {
      const rock = this.floatingRocks[i];
      const baseY = this.floatingRockBaseY[i];
      const speed = this.floatingRockSpeeds[i];
      rock.position.y = baseY + Math.sin(this.time * speed + i) * 0.9;
      rock.rotation.y += deltaSeconds * 0.15;
      rock.rotation.x += deltaSeconds * 0.05;
    }

    // Portal slow rotation
    if (this.portalRing) {
      this.portalRing.rotation.z += deltaSeconds * 0.1;
    }

    // Animate Alien AI Harvesters / Sentinels on Shuka World
    this.alienSentinelNodes.forEach((node, idx) => {
      node.position.y = 3.2 + Math.sin(this.time * 2.0 + idx) * 0.45;
      node.rotation.y += deltaSeconds * 0.6;
    });

    this.alienRingsList.forEach((rings) => {
      if (rings[0]) rings[0].rotation.y += deltaSeconds * 2.2;
      if (rings[1]) rings[1].rotation.x += deltaSeconds * 1.8;
    });
  }
}

