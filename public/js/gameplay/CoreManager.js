/**
 * CoreManager - Manages the five Shuka Energy Cores in EARTH // SHUKA (Phase 6).
 * Vanilla ES6 module version matching js/gameplay/CoreManager.js.
 */

export class CoreManager {
  constructor(scene, audioMgr, onCoreCollected) {
    this.scene = scene;
    this.audioMgr = audioMgr;
    this.cores = [];
    this.onCoreCollectedCallback = onCoreCollected;

    this.initCores();
  }

  initCores() {
    // Configs for 5 Shuka cores
    const configs = [
      { id: 'shuka-core-1', name: 'Shuka Core 1', x: 0, y: 1.8, z: 22, phase: 0.0, speed: 1.0 },
      { id: 'shuka-core-2', name: 'Shuka Core 2', x: 38, y: 2.2, z: 12, phase: 1.25, speed: 1.15 },
      { id: 'shuka-core-3', name: 'Shuka Core 3', x: -32, y: 2.0, z: 30, phase: 2.5, speed: 0.9 },
      { id: 'shuka-core-4', name: 'Shuka Core 4', x: 26, y: 2.5, z: -34, phase: 3.75, speed: 1.05 },
      { id: 'shuka-core-5', name: 'Shuka Core 5', x: -36, y: 2.2, z: -26, phase: 5.0, speed: 0.95 }
    ];

    // Populated if running with full 3D CoreController instances
    this.configs = configs;
  }

  getCoreById(coreId) {
    return this.cores.find((c) => c.coreId === coreId);
  }

  getActiveCoresCount() {
    return this.cores.filter((c) => c.state !== 'COLLECTED').length;
  }

  getCollectedCount() {
    return this.cores.filter((c) => c.state === 'COLLECTED').length;
  }

  getActiveExtractingCore() {
    return this.cores.find((c) => c.state === 'EXTRACTING') || null;
  }

  getNearestAvailableCore(playerPosition) {
    if (!playerPosition || this.cores.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;

    for (const core of this.cores) {
      if (core.state === 'COLLECTED') continue;
      const pos = core.meshRoot ? core.meshRoot.position : core.position;
      const dx = playerPosition.x - pos.x;
      const dy = playerPosition.y - pos.y;
      const dz = playerPosition.z - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < minDist) {
        minDist = dist;
        nearest = core;
      }
    }

    return nearest;
  }

  resetAll() {
    for (const core of this.cores) {
      if (typeof core.reset === 'function') {
        core.reset();
      }
    }
  }
}
