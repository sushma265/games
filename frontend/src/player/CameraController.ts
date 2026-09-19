import * as BABYLON from 'babylonjs';

/**
 * CameraController - Third-person follow camera with cinematic smoothing,
 * pitch/yaw control, terrain collision avoidance, and trauma screen shake.
 */
export class CameraController {
  public camera: BABYLON.TargetCamera;
  private scene: BABYLON.Scene;
  private target: BABYLON.TransformNode;

  // Angles (in radians)
  public yaw: number = 0;
  public pitch: number = 0.28; // slight downward angle

  // Constraints
  private minPitch: number = -0.35;
  private maxPitch: number = 1.15;
  private idealDistance: number = 5.2;
  private currentDistance: number = 5.2;
  private targetHeightOffset: number = 1.4;

  // Camera Shake
  private trauma: number = 0;
  private maxShakeOffset: number = 0.35;

  constructor(scene: BABYLON.Scene, target: BABYLON.TransformNode) {
    this.scene = scene;
    this.target = target;

    // Create target camera without default input listeners to avoid conflicts
    this.camera = new BABYLON.TargetCamera('ThirdPersonCamera', new BABYLON.Vector3(0, 3, -5), this.scene);
    this.camera.fov = 0.95;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 350;
    this.scene.activeCamera = this.camera;
  }

  public update(deltaSeconds: number, cameraDeltas: { dx: number; dy: number }): void {
    // Apply rotational inputs
    this.yaw += cameraDeltas.dx;
    this.pitch -= cameraDeltas.dy;

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

    // Keep yaw normalized between -PI and PI
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;

    // Target focus point (player chest/head height)
    const targetPos = this.target.position.clone();
    targetPos.y += this.targetHeightOffset;

    // Calculate spherical position
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const desiredOffset = new BABYLON.Vector3(
      this.idealDistance * cosPitch * sinYaw,
      this.idealDistance * sinPitch,
      -this.idealDistance * cosPitch * cosYaw
    );

    let desiredPos = targetPos.add(desiredOffset);

    // Simple raycast for obstacle/ground avoidance
    const ray = new BABYLON.Ray(targetPos, desiredOffset.normalizeToNew(), this.idealDistance);
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.name !== 'player' && !mesh.name.startsWith('core');
    });

    if (hit && hit.hit && hit.pickedPoint) {
      // Pull camera slightly in front of hit point
      const hitDist = Math.max(1.2, hit.distance - 0.4);
      this.currentDistance = BABYLON.Scalar.Lerp(this.currentDistance, hitDist, 0.2);
    } else {
      this.currentDistance = BABYLON.Scalar.Lerp(this.currentDistance, this.idealDistance, 0.08);
    }

    desiredPos = targetPos.add(
      new BABYLON.Vector3(
        this.currentDistance * cosPitch * sinYaw,
        this.currentDistance * sinPitch,
        -this.currentDistance * cosPitch * cosYaw
      )
    );

    // Camera Shake trauma decay
    let shakeOffset = BABYLON.Vector3.Zero();
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2) * this.maxShakeOffset;
      shakeOffset = new BABYLON.Vector3(
        (Math.random() * 2 - 1) * shakePower,
        (Math.random() * 2 - 1) * shakePower,
        (Math.random() * 2 - 1) * shakePower
      );
      this.trauma = Math.max(0, this.trauma - deltaSeconds * 1.5);
    }

    // Smooth position interpolation
    this.camera.position = BABYLON.Vector3.Lerp(this.camera.position, desiredPos.add(shakeOffset), 0.25);
    this.camera.setTarget(targetPos);
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public getForwardVector(): BABYLON.Vector3 {
    return new BABYLON.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  public getRightVector(): BABYLON.Vector3 {
    return new BABYLON.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  public reset(): void {
    this.yaw = 0;
    this.pitch = 0.28;
    this.currentDistance = this.idealDistance;
    this.trauma = 0;
  }
}
