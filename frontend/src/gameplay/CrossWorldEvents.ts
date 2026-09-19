import { GameAnnouncement } from '../ui/GameAnnouncement';
import { GameEventFeed } from '../ui/GameEventFeed';

export interface CrossWorldEvent {
  id: string;
  title: string;
  description: string;
  sourceWorld: 'EARTH' | 'SHUKA';
  effectType: 'ENERGY_OUTPUT_DOWN' | 'COMMUNICATION_LOST' | 'PLASMA_WEAPON_UNLOCKED' | 'SHIELD_BOOST' | 'ANOMALY_SURGE';
  durationSeconds: number;
}

export class CrossWorldEventManager {
  private timer: number = 0;
  private interval: number = 30; // Event every 30 seconds
  private activeEvents: CrossWorldEvent[] = [];
  private eventFeed?: GameEventFeed;

  constructor(eventFeed?: GameEventFeed) {
    this.eventFeed = eventFeed;
  }

  public setEventFeed(feed: GameEventFeed): void {
    this.eventFeed = feed;
  }

  public update(deltaSeconds: number, isMatchPlaying: boolean): void {
    if (!isMatchPlaying) return;

    this.timer += deltaSeconds;
    if (this.timer >= this.interval) {
      this.timer = 0;
      this.triggerPeriodicCrossWorldEvent();
    }
  }

  public triggerHumanCoreCollectedConsequence(coreIndex: number): void {
    const title = `CROSS-WORLD EVENT #${coreIndex}`;
    const desc = `Human Relay Overcharge: Planet Shuka Energy Output -10%!`;
    GameAnnouncement.show(title, desc, 'warning', 4000);
    if (this.eventFeed) {
      this.eventFeed.add(`Earth action caused: Shuka Energy Output -10%`, 'warning');
    }
  }

  public triggerAlienCoreCollectedConsequence(coreIndex: number): void {
    const title = `CROSS-WORLD EVENT #${coreIndex}`;
    const desc = `Alien Portal Activated: Earth Satellite Communication Distorted!`;
    GameAnnouncement.show(title, desc, 'alien', 4000);
    if (this.eventFeed) {
      this.eventFeed.add(`Alien action caused: Earth Minimap Signal Distorted`, 'alien');
    }
  }

  private triggerPeriodicCrossWorldEvent(): void {
    const events: { title: string; desc: string; type: 'info' | 'warning' | 'alien' | 'success' }[] = [
      {
        title: '⚡ CROSS-WORLD PLASMA SURGE',
        desc: 'Quantum linkage between Earth & Shuka boosts extraction speed by +15%!',
        type: 'info'
      },
      {
        title: '📡 ATMOSPHERIC INTERFERENCE',
        desc: 'Solar flare across dual worlds! Scan ability range doubled for 10s.',
        type: 'warning'
      },
      {
        title: '🌀 PORTAL RESONANCE',
        desc: 'Core anomaly detected! Both factions gain +10% Energy.',
        type: 'success'
      },
      {
        title: '⚠️ DEFENSE GRID SHIFT',
        desc: 'Alien AI activated planetary shields! EMP cooldown reduced.',
        type: 'alien'
      }
    ];

    const chosen = events[Math.floor(Math.random() * events.length)];
    GameAnnouncement.show(chosen.title, chosen.desc, chosen.type, 4000);
    if (this.eventFeed) {
      this.eventFeed.add(`Event: ${chosen.title}`, chosen.type);
    }
  }

  public reset(): void {
    this.timer = 0;
    this.activeEvents = [];
  }
}
