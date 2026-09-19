import { GameManager } from './core/GameManager';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Fatal: Failed to locate #renderCanvas element');
    return;
  }

  try {
    const game = new GameManager(canvas);
    // Expose for testing & console telemetry
    (window as any).gameManager = game;
    console.log('EARTH // SHUKA initialized successfully. Babylon.js 3D WebGL Engine running.');
  } catch (err) {
    console.error('Failed to initialize EARTH // SHUKA:', err);
  }
});
