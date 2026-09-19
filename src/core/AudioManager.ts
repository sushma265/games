/**
 * AudioManager - Web Audio API procedural synthesizer for sci-fi sounds
 * No external sound files required; instant latency, lightweight, and reliable.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.7;
  private extractOsc: OscillatorNode | null = null;
  private extractGain: GainNode | null = null;

  constructor() {
    // Lazy initialize on first interaction
    const initAudio = () => {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private isSoundEnabled: boolean = true;
  private isMusicEnabled: boolean = true;
  private sfxVolume: number = 0.7;
  private musicVolume: number = 0.5;
  private musicOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.sfxVolume = this.masterVolume;
  }

  public setSFXVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMusicEnabled ? this.musicVolume * 0.1 : 0, this.ctx.currentTime);
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isSoundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.isMusicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.playMusic();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public playMusic(): void {
    if (this.isMuted || !this.isMusicEnabled || this.musicOsc) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      this.musicOsc = ctx.createOscillator();
      this.musicGain = ctx.createGain();
      this.musicOsc.type = 'sine';
      this.musicOsc.frequency.setValueAtTime(110, ctx.currentTime); // Low drone note A2

      this.musicGain.gain.setValueAtTime(0.001, ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0.08 * this.musicVolume, ctx.currentTime + 1.0);

      this.musicOsc.connect(this.musicGain);
      this.musicGain.connect(ctx.destination);
      this.musicOsc.start();
    } catch {
      this.musicOsc = null;
      this.musicGain = null;
    }
  }

  public stopMusic(): void {
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        setTimeout(() => {
          if (this.musicOsc) {
            try { this.musicOsc.stop(); } catch { /* safe */ }
            this.musicOsc.disconnect();
            this.musicOsc = null;
          }
          if (this.musicGain) {
            this.musicGain.disconnect();
            this.musicGain = null;
          }
        }, 550);
      } catch {
        this.musicOsc = null;
        this.musicGain = null;
      }
    }
  }

  public playSFX(type: string): void {
    if (!this.isSoundEnabled || this.isMuted) return;
    switch (type) {
      case 'click': this.playClick(); break;
      case 'footstep': this.playFootstep(); break;
      case 'ping': this.playScanPing(); break;
      case 'emp': this.playEMPSurge(); break;
      case 'overcharge': this.playOvercharge(); break;
      default: this.playClick(); break;
    }
  }

  public playClick(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  public playFootstep(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.06 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  public startExtractionBeam(): void {
    if (this.isMuted || this.extractOsc) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.extractOsc = ctx.createOscillator();
    this.extractGain = ctx.createGain();

    this.extractOsc.type = 'sawtooth';
    this.extractOsc.frequency.setValueAtTime(160, ctx.currentTime);
    this.extractOsc.frequency.linearRampToValueAtTime(280, ctx.currentTime + 2.0);

    // LFO for beam vibration
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(16, ctx.currentTime);
    lfoGain.gain.setValueAtTime(30, ctx.currentTime);
    lfo.connect(this.extractOsc.frequency);
    lfo.start();

    this.extractGain.gain.setValueAtTime(0.01, ctx.currentTime);
    this.extractGain.gain.linearRampToValueAtTime(0.15 * this.masterVolume, ctx.currentTime + 0.2);

    this.extractOsc.connect(this.extractGain);
    this.extractGain.connect(ctx.destination);
    this.extractOsc.start();
  }

  public stopExtractionBeam(): void {
    if (this.extractGain && this.ctx) {
      try {
        this.extractGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          if (this.extractOsc) {
            try { this.extractOsc.stop(); } catch { /* ignore */ }
            this.extractOsc.disconnect();
            this.extractOsc = null;
          }
          if (this.extractGain) {
            this.extractGain.disconnect();
            this.extractGain = null;
          }
        }, 120);
      } catch {
        this.extractOsc = null;
        this.extractGain = null;
      }
    }
  }

  public playCoreCollected(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Resonant futuristic tri-chord
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, ctx.currentTime + idx * 0.07 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.07);
      osc.stop(ctx.currentTime + idx * 0.07 + 0.85);
    });
  }

  public playEMPSurge(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Heavy electric blast down-sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.28 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  }

  public playOvercharge(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Electric disruption crackle
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  public playScanPing(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.18 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }

  public playAlienCoreCollected(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Low ominous klaxon
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.22 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  }

  public playWin(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Victory fanfare chords
    const chord = [392.00, 523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + 2.3);
    });
  }

  public playLose(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Descending power failure
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.25 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.35);
  }

  public playCountdownBeep(highPitch: boolean = false): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const freq = highPitch ? 1760 : 880; // A5 or A6
    const duration = highPitch ? 0.35 : 0.18;

    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2 * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }
}
