import * as BABYLON from 'babylonjs';

/**
 * ShukaWorld - Dark, mysterious alien landscape featuring floating islands,
 * crystalline formations, bioluminescent alien structures, ancient ruins, and atmospheric fog.
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

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.setupAtmosphere();
    this.buildTerrain();
    this.buildAncientRuins();
    this.buildCrystallineFormations();
    this.buildFloatingIslands();
    this.buildBioluminescentFlora();
    this.buildAncientPortal();
  }

  private setupAtmosphere(): void {
    // Bright Crisp Daylight Atmosphere
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogColor = new BABYLON.Color3(0.7, 0.82, 0.94);
    this.scene.fogDensity = 0.005;

    this.scene.clearColor = new BABYLON.Color4(0.62, 0.78, 0.92, 1.0);

    // High-visibility bright ambient & directional lighting
    const hemiLight = new BABYLON.HemisphericLight('shukaHemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 1.35;
    hemiLight.groundColor = new BABYLON.Color3(0.4, 0.45, 0.55); // Crisp ambient underglow
    hemiLight.diffuse = new BABYLON.Color3(0.85, 0.9, 1.0); // Bright sky fill

    const dirLight = new BABYLON.DirectionalLight('shukaMoon', new BABYLON.Vector3(-0.6, -1, 0.4), this.scene);
    dirLight.intensity = 1.45;
    dirLight.diffuse = new BABYLON.Color3(1.0, 0.95, 0.85); // Warm sunbeam
  }

  private buildTerrain(): void {
    // Basalt Ground with procedural vertex displacement
    const ground = BABYLON.MeshBuilder.CreateGround('shukaGround', {
      width: 180,
      height: 180,
      subdivisions: 45
    }, this.scene);
    ground.checkCollisions = true;

    // Apply gentle undulating alien hills
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const distFromCenter = Math.sqrt(x * x + z * z);
        // Flatter in center, rolling mounds on outer rim
        if (distFromCenter > 15) {
          positions[i + 1] = Math.sin(x * 0.12) * Math.cos(z * 0.12) * 2.2 +
                             Math.sin(x * 0.05 + z * 0.05) * 1.5;
        }
      }
      ground.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      ground.createNormals(true);
    }

    const groundMat = new BABYLON.StandardMaterial('shukaGroundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.45, 0.48, 0.58);
    groundMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.35);
    groundMat.specularPower = 16;
    ground.material = groundMat;
    this.groundMesh = ground;

    // Outer crater mountain ring to enclose the arena
    const ringMat = new BABYLON.StandardMaterial('craterRingMat', this.scene);
    ringMat.diffuseColor = new BABYLON.Color3(0.4, 0.42, 0.52);

    const outerRing = BABYLON.MeshBuilder.CreateTorus('craterRim', {
      diameter: 180,
      thickness: 25,
      tessellation: 32
    }, this.scene);
    outerRing.position.y = 8;
    outerRing.material = ringMat;
  }

  private buildAncientRuins(): void {
    const ruinMat = new BABYLON.StandardMaterial('shukaRuinMat', this.scene);
    ruinMat.diffuseColor = new BABYLON.Color3(0.55, 0.58, 0.68);
    ruinMat.specularColor = new BABYLON.Color3(0.2, 0.1, 0.3);

    const glyphMat = new BABYLON.StandardMaterial('shukaGlyphMat', this.scene);
    glyphMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    glyphMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.9); // Violet glyph glow

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
      pillar.position.y = height / 2;
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
    templeBase.position = new BABYLON.Vector3(-36, 0.75, -26);
    templeBase.material = ruinMat;
  }

  private buildCrystallineFormations(): void {
    const crystalCyanMat = new BABYLON.StandardMaterial('crystalCyanMat', this.scene);
    crystalCyanMat.diffuseColor = new BABYLON.Color3(0, 0.3, 0.4);
    crystalCyanMat.emissiveColor = new BABYLON.Color3(0.0, 0.85, 0.95);
    crystalCyanMat.alpha = 0.85;

    const crystalVioletMat = new BABYLON.StandardMaterial('crystalVioletMat', this.scene);
    crystalVioletMat.diffuseColor = new BABYLON.Color3(0.3, 0.05, 0.4);
    crystalVioletMat.emissiveColor = new BABYLON.Color3(0.7, 0.15, 0.95);
    crystalVioletMat.alpha = 0.85;

    // Create clusters of crystalline shards
    const clusterCenters = [
      new BABYLON.Vector3(38, 0, 12),
      new BABYLON.Vector3(-32, 0, 30),
      new BABYLON.Vector3(26, 0, -34),
      new BABYLON.Vector3(-18, 0, -15),
      new BABYLON.Vector3(15, 0, 35)
    ];

    clusterCenters.forEach((center, cIdx) => {
      const shardsCount = 6;
      for (let s = 0; s < shardsCount; s++) {
        const height = 2.5 + Math.random() * 4.5;
        const width = 0.5 + Math.random() * 0.6;
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
          height / 2,
          center.z + Math.sin(angle) * rad
        );
        crystal.rotation.x = (Math.random() - 0.5) * 0.4;
        crystal.rotation.z = (Math.random() - 0.5) * 0.4;
        crystal.rotation.y = Math.random() * Math.PI;
        crystal.material = (s % 2 === 0) ? crystalCyanMat : crystalVioletMat;
      }
    });
  }

  private buildFloatingIslands(): void {
    const rockMat = new BABYLON.StandardMaterial('floatingRockMat', this.scene);
    rockMat.diffuseColor = new BABYLON.Color3(0.09, 0.05, 0.15);
    rockMat.specularColor = new BABYLON.Color3(0.3, 0.2, 0.4);

    const islandPositions = [
      new BABYLON.Vector3(0, 18, 25),
      new BABYLON.Vector3(45, 14, 20),
      new BABYLON.Vector3(-40, 16, 35),
      new BABYLON.Vector3(30, 22, -40),
      new BABYLON.Vector3(-45, 19, -30),
      new BABYLON.Vector3(0, 25, -20),
    ];

    islandPositions.forEach((pos, idx) => {
      // Create irregular floating rock / asteroid shape
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`floatRock_${idx}`, {
        type: 1, // Dodecahedron
        size: 3.5 + (idx % 3) * 1.5
      }, this.scene);
      rock.position = pos.clone();
      rock.material = rockMat;

      this.floatingRocks.push(rock);
      this.floatingRockBaseY.push(pos.y);
      this.floatingRockSpeeds.push(0.6 + Math.random() * 0.8);
    });
  }

  private buildBioluminescentFlora(): void {
    const plantStemMat = new BABYLON.StandardMaterial('plantStemMat', this.scene);
    plantStemMat.diffuseColor = new BABYLON.Color3(0.06, 0.04, 0.1);

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
    archMat.diffuseColor = new BABYLON.Color3(0.1, 0.06, 0.15);

    const ring = BABYLON.MeshBuilder.CreateTorus('portalRing', {
      diameter: 12,
      thickness: 1.2,
      tessellation: 24
    }, this.scene);
    ring.position = new BABYLON.Vector3(-36, 6.5, -26);
    ring.rotation.x = Math.PI / 2;
    ring.material = archMat;

    // Swirling energy vortex inside portal
    const vortexMat = new BABYLON.StandardMaterial('vortexMat', this.scene);
    vortexMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    vortexMat.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0.95);
    vortexMat.alpha = 0.65;

    const vortex = BABYLON.MeshBuilder.CreateDisc('portalVortex', {
      radius: 5.4,
      tessellation: 24
    }, this.scene);
    vortex.position = ring.position.clone();
    vortex.material = vortexMat;

    this.portalRing = ring;
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
  }
}
