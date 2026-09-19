/**
 * CoreController - Manages the test Energy Core on Planet Shuka in Earth // Shuka.
 * JavaScript ES6 module version matching js/gameplay/CoreController.js.
 */
export const CoreState = {
  AVAILABLE: 'AVAILABLE',
  EXTRACTING: 'EXTRACTING',
  COLLECTED: 'COLLECTED'
};

export class CoreController {
  constructor(scene, audioMgr, position) {
    this.scene = scene;
    this.audioMgr = audioMgr;
    this.coreId = 'shuka-core-1';
    this.world = 'SHUKA';
    this.baseY = 1.8;
    this.position = position || new BABYLON.Vector3(0, this.baseY, 14.0);

    this.state = CoreState.AVAILABLE;
    this.extractionDuration = 4.0;
    this.extractionProgress = 0.0;
    this.interactionRadius = 5.0;
    this.isPlayerInRange = false;
    this.playerDistance = Infinity;

    this.showCancelledFeedback = false;
    this.cancelledTimer = 0;
    this.animTime = 0;

    this.buildCoreVisuals();
  }

  buildCoreVisuals() {
    this.meshRoot = new BABYLON.TransformNode('shukaTestCoreRoot', this.scene);
    this.meshRoot.position = this.position.clone();

    // Ground Rune Disc
    this.groundRing = BABYLON.MeshBuilder.CreateDisc('coreGroundRing', { radius: this.interactionRadius, tessellation: 48 }, this.scene);
    this.groundRing.rotation.x = Math.PI / 2;
    this.groundRing.position.y = 0.08 - this.baseY;
    this.groundRing.parent = this.meshRoot;

    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    groundMat.emissiveColor = new BABYLON.Color3(0.0, 0.6, 0.85);
    groundMat.alpha = 0.15;
    groundMat.wireframe = true;
    this.groundRing.material = groundMat;

    // Extraction Ring
    this.extractionRing = BABYLON.MeshBuilder.CreateTorus('coreExtractionRing', { diameter: 2.8, thickness: 0.06, tessellation: 36 }, this.scene);
    this.extractionRing.parent = this.meshRoot;
    this.ringMat = new BABYLON.StandardMaterial('ringMat', this.scene);
    this.ringMat.emissiveColor = new BABYLON.Color3(0.0, 0.9, 1.0);
    this.extractionRing.material = this.ringMat;

    // Outer Cage
    this.outerCage = BABYLON.MeshBuilder.CreatePolyhedron('coreCage', { type: 3, size: 0.95 }, this.scene);
    this.outerCage.parent = this.meshRoot;
    this.cageMat = new BABYLON.StandardMaterial('cageMat', this.scene);
    this.cageMat.wireframe = true;
    this.cageMat.emissiveColor = new BABYLON.Color3(0.1, 0.85, 1.0);
    this.outerCage.material = this.cageMat;

    // Inner Plasma Sphere
    this.innerSphere = BABYLON.MeshBuilder.CreateSphere('innerPlasma', { diameter: 1.15, segments: 16 }, this.scene);
    this.innerSphere.parent = this.meshRoot;
    this.plasmaMat = new BABYLON.StandardMaterial('plasmaMat', this.scene);
    this.plasmaMat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.9);
    this.plasmaMat.emissiveColor = new BABYLON.Color3(0.05, 0.95, 1.0);
    this.innerSphere.material = this.plasmaMat;

    // Point Light
    this.pointLight = new BABYLON.PointLight('coreLight', new BABYLON.Vector3(0, 0, 0), this.scene);
    this.pointLight.parent = this.meshRoot;
    this.pointLight.diffuse = new BABYLON.Color3(0.1, 0.9, 1.0);
    this.pointLight.intensity = 1.6;
  }

  update(deltaSeconds, playerPosition, isExtractActionHeld) {
    if (this.showCancelledFeedback) {
      this.cancelledTimer -= deltaSeconds;
      if (this.cancelledTimer <= 0) {
        this.showCancelledFeedback = false;
      }
    }

    if (this.state === CoreState.COLLECTED) return;

    this.animTime += deltaSeconds;
    this.playerDistance = BABYLON.Vector3.Distance(playerPosition, this.meshRoot.position);
    this.isPlayerInRange = this.playerDistance <= this.interactionRadius;

    // Floating motion
    this.meshRoot.position.y = this.baseY + Math.sin(this.animTime * 2.0) * 0.22;
    this.outerCage.rotation.y += deltaSeconds * 1.0;
    this.innerSphere.rotation.y -= deltaSeconds * 0.8;

    let baseIntensity = 1.6 + Math.sin(this.animTime * 3.5) * 0.35;

    if (this.state === CoreState.AVAILABLE) {
      this.extractionRing.rotation.y += deltaSeconds * 0.6;
      if (this.isPlayerInRange && isExtractActionHeld) {
        this.state = CoreState.EXTRACTING;
        this.showCancelledFeedback = false;
      }
    } else if (this.state === CoreState.EXTRACTING) {
      if (!this.isPlayerInRange) {
        this.cancelExtraction('Player moved away');
      } else if (!isExtractActionHeld) {
        this.cancelExtraction('Key released');
      } else {
        this.extractionProgress += deltaSeconds / this.extractionDuration;
        baseIntensity = 3.2 + Math.sin(this.animTime * 8.0) * 0.8;
        this.extractionRing.rotation.y += deltaSeconds * 3.8;

        if (this.extractionProgress >= 1.0) {
          this.collect();
        }
      }
    }

    this.pointLight.intensity = baseIntensity;
  }

  cancelExtraction() {
    if (this.state === CoreState.EXTRACTING) {
      this.state = CoreState.AVAILABLE;
      this.extractionProgress = 0.0;
      this.showCancelledFeedback = true;
      this.cancelledTimer = 1.5;
    }
  }

  collect() {
    this.state = CoreState.COLLECTED;
    this.extractionProgress = 1.0;
    this.meshRoot.setEnabled(false);
    this.pointLight.setEnabled(false);

    if (this.audioMgr && this.audioMgr.playCoreCollected) {
      this.audioMgr.playCoreCollected();
    }

    console.log('[CORE] Shuka Core 1 collected');

    const payload = { coreId: this.coreId, world: this.world };
    if (this.onCoreCollected) {
      this.onCoreCollected(payload);
    }
    window.dispatchEvent(new CustomEvent('CORE_COLLECTED', { detail: payload }));
  }

  reset() {
    this.state = CoreState.AVAILABLE;
    this.extractionProgress = 0.0;
    this.showCancelledFeedback = false;
    this.cancelledTimer = 0;
    this.meshRoot.setEnabled(true);
    this.pointLight.setEnabled(true);
    console.log('[CORE] Shuka Core 1 reset to AVAILABLE');
  }

  getAsciiProgressBar(totalSegments = 10) {
    const filledCount = Math.round(this.extractionProgress * totalSegments);
    const filled = '█'.repeat(filledCount);
    const empty = '░'.repeat(Math.max(0, totalSegments - filledCount));
    const pct = Math.round(this.extractionProgress * 100);
    return `${filled}${empty} ${pct}%`;
  }
}
