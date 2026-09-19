export interface GameEventItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'alien';
  timestamp: number;
}

export class GameEventFeed {
  private container: HTMLElement;
  private maxItems: number = 5;
  private items: GameEventItem[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public add(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'alien' = 'info'): void {
    const item: GameEventItem = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: Date.now()
    };

    this.items.unshift(item);
    if (this.items.length > this.maxItems) {
      this.items.pop();
    }

    this.render();
  }

  public clear(): void {
    this.items = [];
    this.render();
  }

  private render(): void {
    if (this.items.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="game-event-feed-box space-y-1 text-[11px] font-mono select-none">
        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          MISSION FEED
        </div>
        ${this.items.map((item) => this.renderItem(item)).join('')}
      </div>
    `;
  }

  private renderItem(item: GameEventItem): string {
    let badgeColor = 'border-slate-700 bg-slate-900/80 text-slate-200';
    let icon = '•';

    if (item.type === 'success') {
      badgeColor = 'border-cyan-500/50 bg-cyan-950/80 text-cyan-300';
      icon = '✓';
    } else if (item.type === 'alien' || item.type === 'error') {
      badgeColor = 'border-rose-500/50 bg-rose-950/80 text-rose-300';
      icon = '⚡';
    } else if (item.type === 'warning') {
      badgeColor = 'border-amber-500/50 bg-amber-950/80 text-amber-300';
      icon = '⚠';
    }

    return `
      <div class="event-feed-item flex items-center gap-2 px-2.5 py-1 rounded-md border backdrop-blur-md transition-all animate-fadeIn ${badgeColor}">
        <span class="font-bold">${icon}</span>
        <span class="truncate">${item.message}</span>
      </div>
    `;
  }
}
