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
      <div class="game-event-feed-box space-y-1.5 text-xs font-mono select-none">
        <div class="text-[10px] font-bold text-[#5d707a] uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#08a9c7]"></span>
          MISSION FEED
        </div>
        ${this.items.map((item) => this.renderItem(item)).join('')}
      </div>
    `;
  }

  private renderItem(item: GameEventItem): string {
    let badgeColor = 'border-[#d7e3e8] bg-white text-[#10212b]';

    if (item.type === 'success') {
      badgeColor = 'border-[#08a9c7] bg-[#dff7fb] text-[#0789a3]';
    } else if (item.type === 'alien' || item.type === 'error') {
      badgeColor = 'border-[#dc3f3f] bg-rose-50 text-[#dc3f3f]';
    } else if (item.type === 'warning') {
      badgeColor = 'border-[#e59b17] bg-amber-50 text-[#e59b17]';
    }

    return `
      <div class="event-feed-item flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-all ${badgeColor}">
        <span class="truncate font-bold">${item.message}</span>
      </div>
    `;
  }
}
