/**
 * GameManager - Central controller for the match in EARTH // SHUKA (Phase 5).
 * ES6 Module version matching js/core/GameManager.js.
 */

export const GameState = {
  MENU: 'MENU',
  SETUP: 'SETUP',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WON: 'WON',
  LOST: 'LOST'
};

export class GameManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GameState.PLAYING;
    this.humanCores = 0;
    this.alienCores = 0;
    this.MAX_CORES = 5;

    // Configurable 5 minute timer in seconds
    this.MATCH_DURATION = 300;
    this.matchTime = 0; // Elapsed seconds

    this.collectedCoreIds = new Set();
    this.listeners = [];

    this.setupDebugInterface();
  }

  startGame() {
    this.state = GameState.PLAYING;
    this.emitEvent('GAME_STARTED', {
      state: this.state,
      humanCores: this.humanCores,
      alienCores: this.alienCores
    });
  }

  pauseGame() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.emitEvent('GAME_PAUSED');
    }
  }

  resumeGame() {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.emitEvent('GAME_RESUMED');
    }
  }

  registerHumanCore(coreId) {
    if (this.state !== GameState.PLAYING) return false;

    if (coreId) {
      if (this.collectedCoreIds.has(coreId)) {
        return false;
      }
      this.collectedCoreIds.add(coreId);
    }

    this.humanCores = Math.min(this.MAX_CORES, this.humanCores + 1);
    this.emitEvent('HUMAN_CORE_COLLECTED', {
      humanCores: this.humanCores,
      coreId,
      remainingTime: this.getRemainingTime()
    });

    this.checkWinLose();
    return true;
  }

  registerAlienCore(coreId) {
    if (this.state !== GameState.PLAYING) return false;

    this.alienCores = Math.min(this.MAX_CORES, this.alienCores + 1);
    this.emitEvent('ALIEN_CORE_COLLECTED', {
      alienCores: this.alienCores,
      coreId,
      remainingTime: this.getRemainingTime()
    });

    this.checkWinLose();
    return true;
  }

  checkWinLose() {
    if (this.state !== GameState.PLAYING) return;

    if (this.humanCores >= this.MAX_CORES) {
      this.state = GameState.WON;
      this.emitEvent('GAME_WON', {
        humanCores: this.humanCores,
        alienCores: this.alienCores
      });
    } else if (this.alienCores >= this.MAX_CORES) {
      this.state = GameState.LOST;
      this.emitEvent('GAME_LOST', {
        reason: 'ALIEN_CORES_MAX',
        humanCores: this.humanCores,
        alienCores: this.alienCores
      });
    }
  }

  resetGame() {
    this.state = GameState.PLAYING;
    this.humanCores = 0;
    this.alienCores = 0;
    this.matchTime = 0;
    this.collectedCoreIds.clear();

    if (this.coreCtrl && typeof this.coreCtrl.reset === 'function') {
      this.coreCtrl.reset();
    }

    this.emitEvent('GAME_RESET', {
      state: this.state,
      humanCores: this.humanCores,
      alienCores: this.alienCores,
      remainingTime: this.getRemainingTime(),
      formattedTime: this.getFormattedTime()
    });
  }

  getRemainingTime() {
    return Math.max(0, this.MATCH_DURATION - this.matchTime);
  }

  getFormattedTime() {
    const rem = Math.ceil(this.getRemainingTime());
    const minutes = Math.floor(rem / 60);
    const seconds = rem % 60;
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  updateTimer(deltaSeconds) {
    if (this.state === GameState.PLAYING) {
      this.matchTime += deltaSeconds;
      this.emitEvent('TIMER_UPDATED', {
        matchTime: this.matchTime,
        remainingTime: this.getRemainingTime(),
        formattedTime: this.getFormattedTime()
      });

      if (this.getRemainingTime() <= 0) {
        this.state = GameState.LOST;
        this.emitEvent('GAME_LOST', {
          reason: 'TIME_EXPIRED',
          humanCores: this.humanCores,
          alienCores: this.alienCores
        });
      }
    }
  }

  on(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emitEvent(eventName, payload = {}) {
    for (const listener of this.listeners) {
      try {
        listener(eventName, payload);
      } catch (err) {
        console.error(err);
      }
    }

    try {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { ...payload, timestamp: Date.now() }
        })
      );
    } catch {
      // non-DOM
    }
  }

  setupDebugInterface() {
    if (typeof window !== 'undefined') {
      window.debugGame = {
        addHumanCore: () => {
          this.registerHumanCore(`debug-core-${Date.now()}`);
        },
        addAlienCore: () => {
          this.registerAlienCore(`alien-core-${Date.now()}`);
        },
        reset: () => {
          this.resetGame();
        },
        pause: () => {
          this.pauseGame();
        },
        resume: () => {
          this.resumeGame();
        },
        setTime: (secondsRemaining) => {
          this.matchTime = Math.max(0, this.MATCH_DURATION - secondsRemaining);
        },
        getState: () => ({
          state: this.state,
          humanCores: this.humanCores,
          alienCores: this.alienCores,
          remainingTime: this.getRemainingTime(),
          formattedTime: this.getFormattedTime()
        })
      };
    }
  }
}
