import { NetworkManager } from '../network/NetworkManager';

export type ConnectionState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'RECONNECTING';

export class ConnectionStatusUI {
  private container: HTMLElement;
  private networkMgr: NetworkManager;
  private state: ConnectionState = 'CONNECTING';
  private element: HTMLElement | null = null;
  private unsubs: (() => void)[] = [];

  constructor(container: HTMLElement, networkMgr: NetworkManager) {
    this.container = container;
    this.networkMgr = networkMgr;
    this.setupListeners();
    this.render();
  }

  private setupListeners(): void {
    const unsubConnect = this.networkMgr.on('connect', () => {
      this.setState('CONNECTED');
    });
    this.unsubs.push(unsubConnect);

    const unsubDisconnect = this.networkMgr.on('disconnect', () => {
      this.setState('DISCONNECTED');
    });
    this.unsubs.push(unsubDisconnect);

    const unsubError = this.networkMgr.on('connect_error', () => {
      this.setState('RECONNECTING');
    });
    this.unsubs.push(unsubError);

    // Initial check
    if (this.networkMgr.isConnected) {
      this.state = 'CONNECTED';
    } else {
      this.state = 'CONNECTING';
    }
  }

  public setState(state: ConnectionState): void {
    this.state = state;
    this.updateUI();
  }

  public get getState(): ConnectionState {
    return this.state;
  }

  public get isConnected(): boolean {
    return this.state === 'CONNECTED';
  }

  public render(): void {
    const wrapper = document.createElement('div');
    wrapper.id = 'connection-status-badge';
    wrapper.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/90 shadow-sm text-xs font-mono transition-all duration-200';
    this.element = wrapper;
    this.updateUI();

    // Check if element is already in container
    const existing = this.container.querySelector('#connection-status-badge');
    if (existing) {
      existing.replaceWith(wrapper);
    } else {
      this.container.appendChild(wrapper);
    }
  }

  private updateUI(): void {
    if (!this.element) return;

    let dotClass = 'bg-emerald-500 animate-pulse';
    let textClass = 'text-slate-700 font-semibold';
    let borderClass = 'border-slate-200';
    let text = 'CONNECTED';

    switch (this.state) {
      case 'CONNECTED':
        dotClass = 'bg-emerald-500';
        textClass = 'text-emerald-700 font-bold';
        borderClass = 'border-emerald-200 bg-emerald-50/80';
        text = 'CONNECTED';
        break;
      case 'CONNECTING':
        dotClass = 'bg-amber-400 animate-ping';
        textClass = 'text-amber-700 font-bold';
        borderClass = 'border-amber-200 bg-amber-50/80';
        text = 'CONNECTING...';
        break;
      case 'RECONNECTING':
        dotClass = 'bg-amber-500 animate-pulse';
        textClass = 'text-amber-800 font-bold';
        borderClass = 'border-amber-300 bg-amber-100/80';
        text = 'RECONNECTING...';
        break;
      case 'DISCONNECTED':
        dotClass = 'bg-rose-500';
        textClass = 'text-rose-700 font-bold';
        borderClass = 'border-rose-200 bg-rose-50/80';
        text = 'DISCONNECTED';
        break;
    }

    this.element.className = `inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm text-xs font-mono transition-all duration-200 ${borderClass}`;
    this.element.innerHTML = `
      <span class="w-2 h-2 rounded-full ${dotClass}"></span>
      <span class="${textClass}">${text}</span>
    `;
  }

  public destroy(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
