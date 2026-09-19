import * as BABYLON from 'babylonjs';
import { CameraController } from './CameraController';
import { AudioManager } from '../core/AudioManager';

/**
 * PlayerController - Third-person Human Commander character representation,
 * procedural locomotion animation, extraction beam emitter, and sprint thrusters.
 */
export class PlayerController {
  public root: BABYLON.TransformNode;
  public meshContainer: BABYLON.TransformNode;
  private scene: BABYLON.Scene;
  private cameraCtrl: CameraController;
  private audioMgr: AudioManager;

  // Character body parts for procedural animation
  private leftLeg!: BABYLON.Mesh;
  private rightLeg!: BABYLON.Mesh;
  private leftArm!: BABYLON.Mesh;
  private rightArm!: BABYLON.Mesh;
  private torsoMesh!: BABYLON.Mesh;
  private thrusterParticles!: BABYLON.ParticleSystem;
  private extractionBeam!: BABYLON.LinesMesh | null;

  // Locomotion constants
  private walkSpeed: number = 7.5;
  private sprintSpeed: number = 13.0;
  private turnSpeed: number = 12.0;

  // Animation & Audio state
  private animTime: number = 0;
  private stepTimer: number = 0;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;

  constructor(scene: BABYLON.Scene, cameraCtrl: CameraController, audioMgr: AudioManager) {
    this.scene = scene;
    this.cameraCtrl = cameraCtrl;
    this.audioMgr = audioMgr;

    this.root = new BABYLON.TransformNode('playerRoot', this.scene);
    this.root.position = new BABYLON.Vector3(0, 1.2, 0);

    this.meshContainer = new BABYLON.TransformNode('playerMeshContainer', this.scene);
    this.meshContainer.parent = this.root;

    this.buildCharacterMesh();
    this.setupThrusters();
  }

  private buildCharacterMesh(): void {
    // 1. Materials
    const armorMat = new BABYLON.StandardMaterial('playerArmorMat', this.scene);
    armorMat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.18);
    armorMat.specularColor = new BABYLON.Color3(0.5, 0.6, 0.7);
    armorMat.specularPower = 32;

    const platingMat = new BABYLON.StandardMaterial('playerPlatingMat', this.scene);
    platingMat.diffuseColor = new BABYLON.Color3(0.25, 0.28, 0.35);

    const cyanGlowMat = new BABYLON.StandardMaterial('playerCyanGlowMat', this.scene);
    cyanGlowMat.diffuseColor = new BABYLON.Color3(0, 0.2, 0.25);
    cyanGlowMat.emissiveColor = new BABYLON.Color3(0.0, 0.95, 1.0);

    const jointMat = new BABYLON.StandardMaterial('playerJointMat', this.scene);
    jointMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.06);

    // 2. Torso & Chest Armor
    const torso = BABYLON.MeshBuilder.CreateBox('torso', { width: 0.7, height: 0.85, depth: 0.45 }, this.scene);
    torso.position.y = 1.05;
    torso.material = armorMat;
    torso.parent = this.meshContainer;
    this.torsoMesh = torso;

    // Chest Reactor Arc
    const chestCore = BABYLON.MeshBuilder.CreateCylinder('chestCore', { diameter: 0.22, height: 0.1, tessellation: 16 }, this.scene);
    chestCore.rotation.x = Math.PI / 2;
    chestCore.position = new BABYLON.Vector3(0, 1.15, 0.24);
    chestCore.material = cyanGlowMat;
    chestCore.parent = this.meshContainer;

    // Shoulder Armor Pads
    const leftPad = BABYLON.MeshBuilder.CreateBox('leftShoulder', { width: 0.28, height: 0.18, depth: 0.38 }, this.scene);
    leftPad.position = new BABYLON.Vector3(-0.46, 1.35, 0);
    leftPad.rotation.z = -0.2;
    leftPad.material = platingMat;
    leftPad.parent = this.meshContainer;

    const rightPad = BABYLON.MeshBuilder.CreateBox('rightShoulder', { width: 0.28, height: 0.18, depth: 0.38 }, this.scene);
    rightPad.position = new BABYLON.Vector3(0.46, 1.35, 0);
    rightPad.rotation.z = 0.2;
    rightPad.material = platingMat;
    rightPad.parent = this.meshContainer;

    // 3. Helmet & Visor
    const helmet = BABYLON.MeshBuilder.CreateSphere('helmet', { diameterX: 0.46, diameterY: 0.52, diameterZ: 0.5, segments: 12 }, this.scene);
    helmet.position.y = 1.7;
    helmet.material = armorMat;
    helmet.parent = this.meshContainer;

    const visor = BABYLON.MeshBuilder.CreateBox('visor', { width: 0.32, height: 0.14, depth: 0.25 }, this.scene);
    visor.position = new BABYLON.Vector3(0, 1.7, 0.18);
    visor.material = cyanGlowMat;
    visor.parent = this.meshContainer;

    // 4. Sci-Fi Exploration Jetpack
    const pack = BABYLON.MeshBuilder.CreateBox('jetpack', { width: 0.5, height: 0.6, depth: 0.26 }, this.scene);
    pack.position = new BABYLON.Vector3(0, 1.1, -0.32);
    pack.material = platingMat;
    pack.parent = this.meshContainer;

    const leftThruster = BABYLON.MeshBuilder.CreateCylinder('leftThruster', { diameter: 0.14, height: 0.45, tessellation: 12 }, this.scene);
    leftThruster.position = new BABYLON.Vector3(-0.2, 0.95, -0.36);
    leftThruster.material = armorMat;
    leftThruster.parent = this.meshContainer;

    const rightThruster = BABYLON.MeshBuilder.CreateCylinder('rightThruster', { diameter: 0.14, height: 0.45, tessellation: 12 }, this.scene);
    rightThruster.position = new BABYLON.Vector3(0.2, 0.95, -0.36);
    rightThruster.material = armorMat;
    rightThruster.parent = this.meshContainer;

    // Thruster exhaust emitters
    const nozzleLeft = BABYLON.MeshBuilder.CreateDisc('nozzleL', { radius: 0.06 }, this.scene);
    nozzleLeft.rotation.x = Math.PI / 2;
    nozzleLeft.position = new BABYLON.Vector3(-0.2, 0.72, -0.36);
    nozzleLeft.material = cyanGlowMat;
    nozzleLeft.parent = this.meshContainer;

    const nozzleRight = BABYLON.MeshBuilder.CreateDisc('nozzleR', { radius: 0.06 }, this.scene);
    nozzleRight.rotation.x = Math.PI / 2;
    nozzleRight.position = new BABYLON.Vector3(0.2, 0.72, -0.36);
    nozzleRight.material = cyanGlowMat;
    nozzleRight.parent = this.meshContainer;

    // 5. Limbs (Arms & Legs)
    // Left Arm
    this.leftArm = BABYLON.MeshBuilder.CreateBox('armL', { width: 0.18, height: 0.65, depth: 0.18 }, this.scene);
    this.leftArm.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0));
    this.leftArm.position = new BABYLON.Vector3(-0.46, 1.05, 0);
    this.leftArm.material = platingMat;
    this.leftArm.parent = this.meshContainer;

    // Right Arm (Equipped with Extractor Gauntlet)
    this.rightArm = BABYLON.MeshBuilder.CreateBox('armR', { width: 0.2, height: 0.65, depth: 0.2 }, this.scene);
    this.rightArm.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0));
    this.rightArm.position = new BABYLON.Vector3(0.46, 1.05, 0);
    this.rightArm.material = platingMat;
    this.rightArm.parent = this.meshContainer;

    const gauntletGlow = BABYLON.MeshBuilder.CreateBox('gauntletGlow', { width: 0.22, height: 0.18, depth: 0.22 }, this.scene);
    gauntletGlow.position = new BABYLON.Vector3(0, -0.2, 0.04);
    gauntletGlow.material = cyanGlowMat;
    gauntletGlow.parent = this.rightArm;

    // Left Leg
    this.leftLeg = BABYLON.MeshBuilder.CreateBox('legL', { width: 0.24, height: 0.75, depth: 0.26 }, this.scene);
    this.leftLeg.setPivotPoint(new BABYLON.Vector3(0, 0.35, 0));
    this.leftLeg.position = new BABYLON.Vector3(-0.2, 0.45, 0);
    this.leftLeg.material = platingMat;
    this.leftLeg.parent = this.meshContainer;

    // Right Leg
    this.rightLeg = BABYLON.MeshBuilder.CreateBox('legR', { width: 0.24, height: 0.75, depth: 0.26 }, this.scene);
    this.rightLeg.setPivotPoint(new BABYLON.Vector3(0, 0.35, 0));
    this.rightLeg.position = new BABYLON.Vector3(0.2, 0.45, 0);
    this.rightLeg.material = platingMat;
    this.rightLeg.parent = this.meshContainer;
  }

  private setupThrusters(): void {
    this.thrusterParticles = new BABYLON.ParticleSystem('sprintThrusters', 120, this.scene);
    this.thrusterParticles.emitter = new BABYLON.Vector3(0, 0.8, -0.4);
    this.thrusterParticles.particleTexture = new BABYLON.Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAPElEQVQoU2NkYGBg+M/AwPAfk4wMDAwMHAz//4P5iAqwChAVwE3CqgBWATcJs/94FcAo4FWA12dE+RkAqR8R5dYI9i8AAAAASUVORK5CYII=', this.scene);
    this.thrusterParticles.minEmitBox = new BABYLON.Vector3(-0.2, 0, 0);
    this.thrusterParticles.maxEmitBox = new BABYLON.Vector3(0.2, 0, 0);
    this.thrusterParticles.color1 = new BABYLON.Color4(0.0, 0.95, 1.0, 0.9);
    this.thrusterParticles.color2 = new BABYLON.Color4(0.6, 0.1, 0.9, 0.6);
    this.thrusterParticles.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
    this.thrusterParticles.minSize = 0.1;
    this.thrusterParticles.maxSize = 0.35;
    this.thrusterParticles.minLifeTime = 0.1;
    this.thrusterParticles.maxLifeTime = 0.25;
    this.thrusterParticles.emitRate = 90;
    this.thrusterParticles.direction1 = new BABYLON.Vector3(-0.1, -1.0, -0.6);
    this.thrusterParticles.direction2 = new BABYLON.Vector3(0.1, -1.0, -0.8);
    this.thrusterParticles.minEmitPower = 2.0;
    this.thrusterParticles.maxEmitPower = 4.5;
    this.thrusterParticles.updateSpeed = 0.02;
  }

  public update(deltaSeconds: number, moveInput: { x: number; z: number }, sprintInput: boolean): void {
    const isMoving = Math.abs(moveInput.x) > 0.01 || Math.abs(moveInput.z) > 0.01;
    this.isMoving = isMoving;
    this.isSprinting = isMoving && sprintInput;

    if (isMoving) {
      // Calculate move vector relative to camera direction
      const forward = this.cameraCtrl.getForwardVector();
      const right = this.cameraCtrl.getRightVector();

      const moveDir = forward.scale(moveInput.z).add(right.scale(moveInput.x)).normalize();
      const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

      // Translate character position
      const displacement = moveDir.scale(speed * deltaSeconds);
      this.root.position.addInPlace(displacement);

      // Procedural terrain grounding (simple clamp/raycast to stay above Shuka ground)
      if (this.root.position.y < 1.0) {
        this.root.position.y = 1.0;
      }

      // Smooth rotation to face movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.meshContainer.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.meshContainer.rotation.y += diff * this.turnSpeed * deltaSeconds;

      // Procedural limb animation
      const animSpeed = this.isSprinting ? 14 : 9;
      this.animTime += deltaSeconds * animSpeed;
      const legSwing = Math.sin(this.animTime) * (this.isSprinting ? 0.75 : 0.45);
      const armSwing = Math.cos(this.animTime) * (this.isSprinting ? 0.6 : 0.35);

      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftArm.rotation.x = -armSwing;
      this.rightArm.rotation.x = armSwing;

      // Subtle torso bob
      this.torsoMesh.position.y = 1.05 + Math.abs(Math.sin(this.animTime * 2)) * 0.08;

      // Footstep audio triggers
      this.stepTimer += deltaSeconds * (this.isSprinting ? 3.5 : 2.2);
      if (this.stepTimer >= 1.0) {
        this.audioMgr.playFootstep();
        this.stepTimer = 0;
      }
    } else {
      // Return limbs to idle
      this.leftLeg.rotation.x = BABYLON.Scalar.Lerp(this.leftLeg.rotation.x, 0, 0.2);
      this.rightLeg.rotation.x = BABYLON.Scalar.Lerp(this.rightLeg.rotation.x, 0, 0.2);
      this.leftArm.rotation.x = BABYLON.Scalar.Lerp(this.leftArm.rotation.x, 0, 0.2);
      this.rightArm.rotation.x = BABYLON.Scalar.Lerp(this.rightArm.rotation.x, 0, 0.2);
      this.torsoMesh.position.y = BABYLON.Scalar.Lerp(this.torsoMesh.position.y, 1.05, 0.2);
      this.stepTimer = 0.8;
    }

    // Thruster particles state
    if (this.isSprinting) {
      if (!this.thrusterParticles.isStarted()) {
        this.thrusterParticles.start();
      }
      // Attach emitter to current player position
      this.thrusterParticles.emitter = this.root.position.add(new BABYLON.Vector3(0, 0.8, -0.4));
    } else {
      if (this.thrusterParticles.isStarted()) {
        this.thrusterParticles.stop();
      }
    }
  }

  /**
   * Render dynamic extraction beam from Commander's gauntlet to target Energy Core
   */
  public updateExtractionBeam(targetPos: BABYLON.Vector3 | null): void {
    if (!targetPos) {
      if (this.extractionBeam) {
        this.extractionBeam.dispose();
        this.extractionBeam = null;
      }
      return;
    }

    // Origin is player gauntlet
    const handPos = this.root.position.clone();
    handPos.y += 1.1;

    // Create lightning/electric multi-point stream
    const points: BABYLON.Vector3[] = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const basePoint = BABYLON.Vector3.Lerp(handPos, targetPos, t);
      if (i > 0 && i < segments) {
        // Add electrical jitter
        const jitter = 0.15;
        basePoint.x += (Math.random() * 2 - 1) * jitter;
        basePoint.y += (Math.random() * 2 - 1) * jitter;
        basePoint.z += (Math.random() * 2 - 1) * jitter;
      }
      points.push(basePoint);
    }

    if (this.extractionBeam) {
      this.extractionBeam = BABYLON.MeshBuilder.CreateLines(
        'extractBeam',
        { points, instance: this.extractionBeam },
        this.scene
      );
    } else {
      this.extractionBeam = BABYLON.MeshBuilder.CreateLines('extractBeam', { points, updatable: true }, this.scene);
      this.extractionBeam.color = new BABYLON.Color3(0, 0.95, 1);
    }
  }

  public setPosition(pos: BABYLON.Vector3): void {
    this.root.position = pos.clone();
  }
}
