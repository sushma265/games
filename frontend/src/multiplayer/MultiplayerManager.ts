import * as BABYLON from 'babylonjs';
import { NetworkManager, NetworkPlayer, Vector3D } from '../network/NetworkManager';
import { RemotePlayer } from './RemotePlayer';
import { PlayerController } from '../player/PlayerController';

/**
 * MultiplayerManager - Synchronizes real-time multiplayer operatives in EARTH // SHUKA.
 * Handles remote player lifecycle, interpolation, and throttled local movement emissions.
 */
export class MultiplayerManager {
  private scene: BABYLON.Scene;
  private networkMgr: NetworkManager;
  private playerCtrl: PlayerController;

  // Remote Players (keyed by socket ID)
  public remotePlayers: Map<string, RemotePlayer> = new Map();

  // Throttling configuration (15 updates / sec = ~66.6ms)
  private readonly UPDATE_INTERVAL: number = 0.066;
  private updateTimer: number = 0;
  private lastEmittedPos: BABYLON.Vector3 = new BABYLON.Vector3(-999, -999, -999);
  private lastEmittedRotY: number = -999;

  constructor(scene: BABYLON.Scene, networkMgr: NetworkManager, playerCtrl: PlayerController) {
    this.scene = scene;
    this.networkMgr = networkMgr;
    this.playerCtrl = playerCtrl;

    this.bindNetworkEvents();
  }

  /**
   * Subscribes to Socket.IO game synchronization events
   */
  private bindNetworkEvents(): void {
    // 1. Initial players state broadcast on game start
    this.networkMgr.on('PLAYERS_INITIAL_STATE', (data: { players: NetworkPlayer[] }) => {
      this.handlePlayersInitialState(data.players || []);
    });

    // Also handle GAME_STARTED if players are passed there
    this.networkMgr.on('GAME_STARTED', (data: { players?: NetworkPlayer[] }) => {
      if (data.players && data.players.length > 0) {
        this.handlePlayersInitialState(data.players);
      }
    });

    // 2. Late-joining player
    this.networkMgr.on('PLAYER_JOINED_GAME', (data: { player: NetworkPlayer }) => {
      if (data.player && data.player.id !== this.networkMgr.localPlayerId) {
        this.addRemotePlayer(data.player);
      }
    });

    // 3. Movement update received from another player in room
    this.networkMgr.on('PLAYER_UPDATED', (data: { id: string; position: Vector3D; rotation: Vector3D }) => {
      if (!data || data.id === this.networkMgr.localPlayerId) return;

      const remote = this.remotePlayers.get(data.id);
      if (remote) {
        remote.updateNetworkTarget(data.position, data.rotation);
      }
    });

    // 4. Remote player departed or disconnected
    this.networkMgr.on('PLAYER_LEFT_GAME', (data: { id: string; playerName?: string }) => {
      if (data && data.id) {
        this.removeRemotePlayer(data.id);
      }
    });

    this.networkMgr.on('PLAYER_LEFT', (data: { playerId: string }) => {
      if (data && data.playerId) {
        this.removeRemotePlayer(data.playerId);
      }
    });
  }

  /**
   * Initializes all players when entering PLAYING state
   */
  public handlePlayersInitialState(players: NetworkPlayer[]): void {
    const localId = this.networkMgr.localPlayerId;
    console.log(`[MultiplayerManager] Initializing ${players.length} players. Local ID: ${localId}`);

    // Remove existing remote players first
    this.clearAllRemotePlayers();

    for (const p of players) {
      if (p.id === localId) {
        // Spawn local player at assigned spawn coordinates
        if (p.position) {
          this.playerCtrl.root.position.set(p.position.x, p.position.y, p.position.z);
          this.lastEmittedPos.copyFrom(this.playerCtrl.root.position);
          console.log(`[MultiplayerManager] Local player spawned at (${p.position.x}, ${p.position.y}, ${p.position.z})`);
        }
      } else {
        // Instantiate remote player
        this.addRemotePlayer(p);
      }
    }
  }

  /**
   * Instantiates a new remote player character in the 3D world
   */
  public addRemotePlayer(player: NetworkPlayer): void {
    if (this.remotePlayers.has(player.id)) return;

    const initialPos: Vector3D = player.position || { x: 0, y: 1.2, z: 0 };
    const initialRot: Vector3D = player.rotation || { x: 0, y: 0, z: 0 };

    const remote = new RemotePlayer(
      player.id,
      player.name || 'Operative',
      initialPos,
      initialRot,
      this.scene
    );

    this.remotePlayers.set(player.id, remote);
    console.log(`[MultiplayerManager] Spawned remote player: ${player.name} (${player.id}) at (${initialPos.x}, ${initialPos.y}, ${initialPos.z})`);
  }

  /**
   * Removes and disposes a remote player
   */
  public removeRemotePlayer(id: string): void {
    const remote = this.remotePlayers.get(id);
    if (remote) {
      console.log(`[MultiplayerManager] Disposing remote player: ${remote.name} (${id})`);
      remote.dispose();
      this.remotePlayers.delete(id);
    }
  }

  /**
   * Cleans up all remote players
   */
  public clearAllRemotePlayers(): void {
    this.remotePlayers.forEach((remote) => {
      remote.dispose();
    });
    this.remotePlayers.clear();
  }

  /**
   * Main tick update:
   * 1. Interpolates and animates all remote operatives
   * 2. Throttles and broadcasts local movement updates (15 times / second)
   */
  public update(deltaSeconds: number, isPlaying: boolean): void {
    // 1. Update remote players
    this.remotePlayers.forEach((remote) => {
      remote.update(deltaSeconds);
    });

    // 2. Throttled Local Movement Update (only while match is actively PLAYING)
    if (!isPlaying || !this.networkMgr.isConnected || !this.networkMgr.currentRoom) {
      return;
    }

    this.updateTimer += deltaSeconds;
    if (this.updateTimer >= this.UPDATE_INTERVAL) {
      this.updateTimer = 0;
      this.emitLocalMovementIfChanged();
    }
  }

  /**
   * Checks if local position or Y rotation has changed significantly, then sends update
   */
  private emitLocalMovementIfChanged(): void {
    const currentPos = this.playerCtrl.root.position;
    const currentRotY = this.playerCtrl.meshContainer.rotation.y;

    const posDelta = BABYLON.Vector3.Distance(currentPos, this.lastEmittedPos);
    const rotDelta = Math.abs(currentRotY - this.lastEmittedRotY);

    // Send update if position changed > 0.02m or rotation changed > 0.02 rad (~1.1 deg)
    if (posDelta > 0.02 || rotDelta > 0.02) {
      this.networkMgr.sendPlayerUpdate({
        position: {
          x: Math.round(currentPos.x * 100) / 100,
          y: Math.round(currentPos.y * 100) / 100,
          z: Math.round(currentPos.z * 100) / 100
        },
        rotation: {
          x: 0,
          y: Math.round(currentRotY * 100) / 100,
          z: 0
        }
      });

      this.lastEmittedPos.copyFrom(currentPos);
      this.lastEmittedRotY = currentRotY;
    }
  }

  /**
   * Diagnostics helper
   */
  public getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  public getRemotePlayerList(): { id: string; name: string; position: Vector3D }[] {
    const list: { id: string; name: string; position: Vector3D }[] = [];
    this.remotePlayers.forEach((r) => {
      list.push({
        id: r.id,
        name: r.name,
        position: {
          x: r.root.position.x,
          y: r.root.position.y,
          z: r.root.position.z
        }
      });
    });
    return list;
  }
}
