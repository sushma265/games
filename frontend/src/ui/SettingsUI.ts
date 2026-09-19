import { AudioManager } from '../core/AudioManager';
import { NotificationToast } from './NotificationToast';

export interface GameSettings {
  sound: boolean;
  music: boolean;
  graphics: 'LOW' | 'MEDIUM' | 'HIGH';
  showTutorial: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  music: true,
  graphics: 'HIGH',
  showTutorial: true
};

export class SettingsUI {
  private container: HTMLElement;
  private audioMgr: AudioManager;
  private onBackCallback: () => void;
  public settings: GameSettings = { ...DEFAULT_SETTINGS };

  constructor(container: HTMLElement, audioMgr: AudioManager, onBack: () => void) {
    this.container = container;
    this.audioMgr = audioMgr;
    this.onBackCallback = onBack;
    this.loadSettings();
    this.render();
  }

  public loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem('earth_shuka_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.applyAudioSettings();
    return this.settings;
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('earth_shuka_settings', JSON.stringify(this.settings));
    } catch {
      // safe fallback
    }
    this.applyAudioSettings();
  }

  private applyAudioSettings(): void {
    if (this.audioMgr) {
      this.audioMgr.setSoundEnabled(this.settings.sound);
      this.audioMgr.setMusicEnabled(this.settings.music);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <div class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-800 my-auto">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <div class="text-xs font-mono font-bold text-sky-600 tracking-[0.2em] uppercase">
                SYSTEM CONFIGURATION
              </div>
              <h2 class="text-2xl font-black font-display text-slate-900 tracking-wide">
                SETTINGS
              </h2>
            </div>
            <button id="btn-settings-close" class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold text-lg transition-colors">
              ✕
            </button>
          </div>

          <!-- Settings Items -->
          <div class="space-y-4 font-mono text-xs">
            
            <!-- SOUND -->
            <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span class="font-bold text-slate-900 text-sm block">SOUND EFFECTS</span>
                <span class="text-[11px] text-slate-500">Audio cues & ability SFX</span>
              </div>
              <button 
                id="btn-toggle-sound" 
                class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border transition-colors shadow-sm cursor-pointer ${
                  this.settings.sound 
                    ? 'bg-sky-600 border-sky-700 text-white' 
                    : 'bg-slate-200 border-slate-300 text-slate-600'
                }"
              >
                ${this.settings.sound ? 'ON' : 'OFF'}
              </button>
            </div>

            <!-- MUSIC -->
            <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span class="font-bold text-slate-900 text-sm block">BACKGROUND MUSIC</span>
                <span class="text-[11px] text-slate-500">Ambient tactical soundtrack</span>
              </div>
              <button 
                id="btn-toggle-music" 
                class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border transition-colors shadow-sm cursor-pointer ${
                  this.settings.music 
                    ? 'bg-sky-600 border-sky-700 text-white' 
                    : 'bg-slate-200 border-slate-300 text-slate-600'
                }"
              >
                ${this.settings.music ? 'ON' : 'OFF'}
              </button>
            </div>

            <!-- GRAPHICS -->
            <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span class="font-bold text-slate-900 text-sm block">GRAPHICS QUALITY</span>
                <span class="text-[11px] text-slate-500">Particle effects & resolution</span>
              </div>
              <div class="flex gap-1">
                ${(['LOW', 'MEDIUM', 'HIGH'] as const).map(q => `
                  <button 
                    data-quality="${q}" 
                    class="btn-graphics-quality px-2.5 py-1.5 rounded-md font-bold text-[11px] border transition-colors cursor-pointer ${
                      this.settings.graphics === q 
                        ? 'bg-sky-600 border-sky-700 text-white' 
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }"
                  >
                    ${q}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- SHOW TUTORIAL -->
            <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span class="font-bold text-slate-900 text-sm block">SHOW TUTORIAL</span>
                <span class="text-[11px] text-slate-500">Objective hints & onboarding</span>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  id="btn-reset-tutorial" 
                  class="px-2.5 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                >
                  RESET
                </button>
                <button 
                  id="btn-toggle-tutorial" 
                  class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border transition-colors shadow-sm cursor-pointer ${
                    this.settings.showTutorial 
                      ? 'bg-sky-600 border-sky-700 text-white' 
                      : 'bg-slate-200 border-slate-300 text-slate-600'
                  }"
                >
                  ${this.settings.showTutorial ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

          </div>

          <!-- Footer Back Button -->
          <div class="pt-2 border-t border-slate-200">
            <button id="btn-settings-back" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-display text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors shadow-sm cursor-pointer">
              BACK TO MAIN MENU
            </button>
          </div>

        </div>
      </div>
    `;

    this.attachHandlers();
  }

  private attachHandlers(): void {
    this.container.querySelector('#btn-settings-close')?.addEventListener('click', () => this.onBackCallback());
    this.container.querySelector('#btn-settings-back')?.addEventListener('click', () => this.onBackCallback());

    this.container.querySelector('#btn-reset-tutorial')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('earthShukaTutorialSeen');
      } catch {}
      NotificationToast.show({ message: 'Tutorial reset! It will show on next match.', type: 'info' });
      if (this.audioMgr) this.audioMgr.playClick();
    });

    this.container.querySelector('#btn-toggle-sound')?.addEventListener('click', () => {
      this.settings.sound = !this.settings.sound;
      this.saveSettings();
      this.render();
      if (this.audioMgr && this.settings.sound) this.audioMgr.playClick();
    });

    this.container.querySelector('#btn-toggle-music')?.addEventListener('click', () => {
      this.settings.music = !this.settings.music;
      this.saveSettings();
      this.render();
      if (this.audioMgr) this.audioMgr.playClick();
    });

    this.container.querySelectorAll('.btn-graphics-quality').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const q = target.getAttribute('data-quality') as 'LOW' | 'MEDIUM' | 'HIGH';
        if (q) {
          this.settings.graphics = q;
          this.saveSettings();
          this.render();
          if (this.audioMgr) this.audioMgr.playClick();
        }
      });
    });

    this.container.querySelector('#btn-toggle-tutorial')?.addEventListener('click', () => {
      this.settings.showTutorial = !this.settings.showTutorial;
      this.saveSettings();
      this.render();
      if (this.audioMgr) this.audioMgr.playClick();
    });
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
