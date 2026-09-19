export class GameAnnouncement {
  private static activeTimeout: any = null;

  public static show(
    message: string,
    subtext?: string,
    type: 'success' | 'warning' | 'alien' | 'info' = 'info',
    durationMs: number = 3000
  ): void {
    let slot = document.getElementById('game-announcement-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'game-announcement-slot';
      slot.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center transition-all duration-300 transform scale-95 opacity-0';
      document.body.appendChild(slot);
    }

    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }

    let borderColor = 'border-cyan-500/60 text-cyan-300 bg-slate-950/90';
    let titleColor = 'text-cyan-400';

    if (type === 'warning') {
      borderColor = 'border-amber-500/60 text-amber-300 bg-slate-950/90';
      titleColor = 'text-amber-400';
    } else if (type === 'alien') {
      borderColor = 'border-rose-500/60 text-rose-300 bg-slate-950/90';
      titleColor = 'text-rose-400';
    } else if (type === 'success') {
      borderColor = 'border-cyan-400/80 text-cyan-200 bg-cyan-950/90';
      titleColor = 'text-cyan-300';
    }

    slot.innerHTML = `
      <div class="inline-block px-6 py-3 rounded-2xl border ${borderColor} backdrop-blur-xl shadow-2xl space-y-0.5 animate-bounce-short">
        <div class="text-xs font-mono font-bold tracking-[0.25em] uppercase ${titleColor}">
          ${message}
        </div>
        ${subtext ? `<div class="text-[11px] font-mono text-slate-300 tracking-wider">${subtext}</div>` : ''}
      </div>
    `;

    // Trigger appearance animation
    requestAnimationFrame(() => {
      slot!.classList.remove('scale-95', 'opacity-0');
      slot!.classList.add('scale-100', 'opacity-100');
    });

    this.activeTimeout = setTimeout(() => {
      if (slot) {
        slot.classList.remove('scale-100', 'opacity-100');
        slot.classList.add('scale-95', 'opacity-0');
      }
    }, durationMs);
  }

  public static clear(): void {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    const slot = document.getElementById('game-announcement-slot');
    if (slot) {
      slot.innerHTML = '';
      slot.classList.remove('scale-100', 'opacity-100');
      slot.classList.add('scale-95', 'opacity-0');
    }
  }
}
