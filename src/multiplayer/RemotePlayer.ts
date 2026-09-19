import * as BABYLON from 'babylonjs';
import { Vector3D } from '../network/NetworkManager';

/**
 * RemotePlayer - Visual 3D humanoid representation and interpolation
 * for remote network operatives in EARTH // SHUKA.
 */
export class RemotePlayer {
  public readonly id: string;
  public readonly name: string;
  public readonly root: BABYLON.TransformNode;

  private scene: BABYLON.Scene;
  private meshContainer: BABYLON.TransformNode;

  // Humanoid meshes for procedural locomotion
  private torsoMesh!: BABYLON.Mesh;
  private headMesh!: BABYLON.Mesh;
  private visorMesh!: BABYLON.Mesh;
  private leftArm!: BABYLON.Mesh;
  private rightArm!: BABYLON.Mesh;
  private leftLeg!: BABYLON.Mesh;
  private rightLeg!: BABYLON.Mesh;

  // Floating Camera-Facing Name Tag
  private nameTagPlane!: BABYLON.Mesh;
  private nameTexture!: BABYLON.DynamicTexture;

  // Network Interpolation State
  public targetPosition: BABYLON.Vector3;
  public targetRotationY: number = 0;
  private isMoving: boolean = false;
  private animTime: number = 0;

  constructor(
    id: string,
    name: string,
    initialPos: Vector3D,
    initialRot: Vector3D,
    scene: BABYLON.Scene
  ) {
    this.id = id;
    this.name = name || 'Operative';
    this.scene = scene;

    this.root = new BABYLON.TransformNode(`remote_player_${id}`, this.scene);
    this.root.position = new BABYLON.Vector3(initialPos.x, initialPos.y, initialPos.z);
    this.root.rotation = new BABYLON.Vector3(0, initialRot.y, 0);

    this.targetPosition = this.root.position.clone();
    this.targetRotationY = initialRot.y;

    this.meshContainer = new BABYLON.TransformNode(`remote_mesh_${id}`, this.scene);
    this.meshContainer.parent = this.root;

    this.buildHumanoidMeshes();
    this.buildNameTag();
  }

  /**
   * Constructs the low-poly humanoid operative placeholder
   */
  private buildHumanoidMeshes(): void {
    // 1. Materials
    const armorMat = new BABYLON.StandardMaterial(`remoteArmor_${this.id}`, this.scene);
    armorMat.diffuseColor = new BABYLON.Color3(0.18, 0.22, 0.3);
    armorMat.specularColor = new BABYLON.Color3(0.4, 0.6, 0.7);
    armorMat.specularPower = 24;

    const platingMat = new BABYLON.StandardMaterial(`remotePlating_${this.id}`, this.scene);
    platingMat.diffuseColor = new BABYLON.Color3(0.28, 0.35, 0.44);

    const visorMat = new BABYLON.StandardMaterial(`remoteVisor_${this.id}`, this.scene);
    visorMat.diffuseColor = new BABYLON.Color3(0, 0.95, 1);
    visorMat.emissiveColor = new BABYLON.Color3(0, 0.75, 0.95);

    const jointMat = new BABYLON.StandardMaterial(`remoteJoint_${this.id}`, this.scene);
    jointMat.diffuseColor = new BABYLON.Color3(0.08, 0.09, 0.12);

    // 2. Torso (Body)
    this.torsoMesh = BABYLON.MeshBuilder.CreateBox(
      `remote_torso_${this.id}`,
      { width: 0.8, height: 1.05, depth: 0.45 },
      this.scene
    );
    this.torsoMesh.position.y = 0.55;
    this.torsoMesh.material = armorMat;
    this.torsoMesh.parent = this.meshContainer;

    // Chest Plate accent
    const chestPlate = BABYLON.MeshBuilder.CreateBox(
      `remote_chest_${this.id}`,
      { width: 0.7, height: 0.55, depth: 0.12 },
      this.scene
    );
    chestPlate.position = new BABYLON.Vector3(0, 0.2, 0.22);
    chestPlate.material = platingMat;
    chestPlate.parent = this.torsoMesh;

    // 3. Head & Visor
    this.headMesh = BABYLON.MeshBuilder.CreateBox(
      `remote_head_${this.id}`,
      { width: 0.46, height: 0.48, depth: 0.46 },
      this.scene
    );
    this.headMesh.position.y = 1.35;
    this.headMesh.material = armorMat;
    this.headMesh.parent = this.meshContainer;

    this.visorMesh = BABYLON.MeshBuilder.CreateBox(
      `remote_visor_${this.id}`,
      { width: 0.36, height: 0.16, depth: 0.08 },
      this.scene
    );
    this.visorMesh.position = new BABYLON.Vector3(0, 0.03, 0.22);
    this.visorMesh.material = visorMat;
    this.visorMesh.parent = this.headMesh;

    // 4. Arms (Pivoted for swing animation)
    const armWidth = 0.22;
    const armHeight = 0.85;
    const armDepth = 0.22;

    // Left Arm
    const leftArmPivot = new BABYLON.TransformNode(`remote_leftArmPivot_${this.id}`, this.scene);
    leftArmPivot.position = new BABYLON.Vector3(-0.54, 0.95, 0);
    leftArmPivot.parent = this.meshContainer;

    this.leftArm = BABYLON.MeshBuilder.CreateBox(
      `remote_leftArm_${this.id}`,
      { width: armWidth, height: armHeight, depth: armDepth },
      this.scene
    );
    this.leftArm.position.y = -armHeight / 2;
    this.leftArm.material = platingMat;
    this.leftArm.parent = leftArmPivot;

    // Right Arm
    const rightArmPivot = new BABYLON.TransformNode(`remote_rightArmPivot_${this.id}`, this.scene);
    rightArmPivot.position = new BABYLON.Vector3(0.54, 0.95, 0);
    rightArmPivot.parent = this.meshContainer;

    this.rightArm = BABYLON.MeshBuilder.CreateBox(
      `remote_rightArm_${this.id}`,
      { width: armWidth, height: armHeight, depth: armDepth },
      this.scene
    );
    this.rightArm.position.y = -armHeight / 2;
    this.rightArm.material = platingMat;
    this.rightArm.parent = rightArmPivot;

    // 5. Legs (Pivoted for walk/run animation)
    const legWidth = 0.26;
    const legHeight = 0.95;
    const legDepth = 0.28;

    // Left Leg
    const leftLegPivot = new BABYLON.TransformNode(`remote_leftLegPivot_${this.id}`, this.scene);
    leftLegPivot.position = new BABYLON.Vector3(-0.25, 0.05, 0);
    leftLegPivot.parent = this.meshContainer;

    this.leftLeg = BABYLON.MeshBuilder.CreateBox(
      `remote_leftLeg_${this.id}`,
      { width: legWidth, height: legHeight, depth: legDepth },
      this.scene
    );
    this.leftLeg.position.y = -legHeight / 2;
    this.leftLeg.material = armorMat;
    this.leftLeg.parent = leftLegPivot;

    // Right Leg
    const rightLegPivot = new BABYLON.TransformNode(`remote_rightLegPivot_${this.id}`, this.scene);
    rightLegPivot.position = new BABYLON.Vector3(0.25, 0.05, 0);
    rightLegPivot.parent = this.meshContainer;

    this.rightLeg = BABYLON.MeshBuilder.CreateBox(
      `remote_rightLeg_${this.id}`,
      { width: legWidth, height: legHeight, depth: legDepth },
      this.scene
    );
    this.rightLeg.position.y = -legHeight / 2;
    this.rightLeg.material = armorMat;
    this.rightLeg.parent = rightLegPivot;
  }

  /**
   * Floating Billboard Name Tag above character head
   */
  private buildNameTag(): void {
    const planeWidth = 2.4;
    const planeHeight = 0.7;

    this.nameTagPlane = BABYLON.MeshBuilder.CreatePlane(
      `nameTag_${this.id}`,
      { width: planeWidth, height: planeHeight },
      this.scene
    );
    this.nameTagPlane.position = new BABYLON.Vector3(0, 2.25, 0);
    this.nameTagPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    this.nameTagPlane.parent = this.root;

    // Dynamic texture for crisp text rendering
    const texWidth = 320;
    const texHeight = 90;
    this.nameTexture = new BABYLON.DynamicTexture(
      `nameTexture_${this.id}`,
      { width: texWidth, height: texHeight },
      this.scene,
      false
    );
    this.nameTexture.hasAlpha = true;

    const ctx = this.nameTexture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, texWidth, texHeight);

    // Rounded sci-fi backing badge
    const radius = 18;
    const x = 12;
    const y = 8;
    const w = texWidth - 24;
    const h = texHeight - 16;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00f3ff';
    ctx.stroke();

    // Player Name text
    ctx.font = 'bold 30px "Orbitron", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.name, texWidth / 2, texHeight / 2);

    this.nameTexture.update();

    const tagMat = new BABYLON.StandardMaterial(`nameTagMat_${this.id}`, this.scene);
    tagMat.diffuseTexture = this.nameTexture;
    tagMat.opacityTexture = this.nameTexture;
    tagMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    tagMat.disableLighting = true;
    tagMat.backFaceCulling = false;

    this.nameTagPlane.material = tagMat;
  }

  /**
   * Set new target position and rotation received from network
   */
  public updateNetworkTarget(position: Vector3D, rotation: Vector3D): void {
    if (position) {
      this.targetPosition.set(position.x, position.y, position.z);
    }
    if (rotation && typeof rotation.y === 'number') {
      this.targetRotationY = rotation.y;
    }
  }

  /**
   * Per-frame smooth interpolation and procedural locomotion update
   */
  public update(deltaSeconds: number): void {
    // 1. Position Interpolation (Lerp)
    const distanceToTarget = BABYLON.Vector3.Distance(this.root.position, this.targetPosition);
    this.isMoving = distanceToTarget > 0.08;

    // Smooth lerp factor (fast enough to not lag, smooth enough to avoid stutter)
    const lerpFactor = Math.min(1.0, deltaSeconds * 12.0);
    this.root.position = BABYLON.Vector3.Lerp(this.root.position, this.targetPosition, lerpFactor);

    // 2. Y-Rotation Interpolation (with wrap-around shortest path)
    let rotDiff = this.targetRotationY - this.root.rotation.y;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.root.rotation.y += rotDiff * lerpFactor;

    // 3. Procedural Limb Animation while moving
    if (this.isMoving) {
      this.animTime += deltaSeconds;
      const swingSpeed = 10.0;
      const legAngle = Math.sin(this.animTime * swingSpeed) * 0.45;
      const armAngle = Math.sin(this.animTime * swingSpeed) * 0.35;

      if (this.leftLeg.parent) (this.leftLeg.parent as BABYLON.TransformNode).rotation.x = legAngle;
      if (this.rightLeg.parent) (this.rightLeg.parent as BABYLON.TransformNode).rotation.x = -legAngle;
      if (this.leftArm.parent) (this.leftArm.parent as BABYLON.TransformNode).rotation.x = -armAngle;
      if (this.rightArm.parent) (this.rightArm.parent as BABYLON.TransformNode).rotation.x = armAngle;
    } else {
      // Smoothly return limbs to rest pose
      const decay = Math.min(1.0, deltaSeconds * 8.0);
      if (this.leftLeg.parent) (this.leftLeg.parent as BABYLON.TransformNode).rotation.x *= 1 - decay;
      if (this.rightLeg.parent) (this.rightLeg.parent as BABYLON.TransformNode).rotation.x *= 1 - decay;
      if (this.leftArm.parent) (this.leftArm.parent as BABYLON.TransformNode).rotation.x *= 1 - decay;
      if (this.rightArm.parent) (this.rightArm.parent as BABYLON.TransformNode).rotation.x *= 1 - decay;
    }
  }

  /**
   * Completely disposes meshes, materials, textures, and nodes
   */
  public dispose(): void {
    if (this.nameTexture) {
      this.nameTexture.dispose();
    }
    if (this.nameTagPlane) {
      this.nameTagPlane.dispose();
    }
    if (this.meshContainer) {
      this.meshContainer.dispose(false, true);
    }
    if (this.root) {
      this.root.dispose(false, true);
    }
  }
}
