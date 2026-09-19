import { io, Socket } from 'socket.io-client';
import { SpecialistAllocation, SPECIALIST_CONFIG } from '../types';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface NetworkPlayer {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  position?: Vector3D;
  rotation?: Vector3D;
}

export type NetworkRoomStatus = 'LOBBY' | 'STARTING' | 'SPECIALIST_ALLOCATION' | 'PLAYING' | 'FINISHED';

export interface NetworkRoom {
  code: string;
  hostId: string;
  status: NetworkRoomStatus;
  maxPlayers: number;
  players: NetworkPlayer[];
  countdownValue?: number;
  specialists?: SpecialistAllocation;
}

export type NetworkEventCallback = (data: any) => void;

/**
 * NetworkManager - Real-Time Socket.IO Client for EARTH // SHUKA
 * Handles client-server network protocol, room creation, joining, ready states,
 * countdown events, and host match triggers without polluting GameManager gameplay logic.
 */
export class NetworkManager {
  private socket: Socket | null = null;
  public currentRoom: NetworkRoom | null = null;
  public localPlayerId: string | null = null;
  public localPlayerName: string = '';
  public specialists: SpecialistAllocation = {
    total: SPECIALIST_CONFIG.totalSpecialists,
    earthDefense: SPECIALIST_CONFIG.defaultEarthDefense,
    shukaExtraction: SPECIALIST_CONFIG.defaultShukaExtraction,
    isLocked: false
  };
  private listeners: Map<string, Set<NetworkEventCallback>> = new Map();

  constructor() {
    // Lazy or immediate connection
    this.connect();
  }

  public connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.connect();
      return this.socket;
    }

    // Connect to same origin host/port
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      this.localPlayerId = this.socket?.id || null;
      console.log(`[NetworkManager] Connected to server. ID: ${this.localPlayerId}`);
      this.emitInternal('connect', { id: this.localPlayerId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[NetworkManager] Disconnected: ${reason}`);
      this.emitInternal('disconnect', { reason });
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[NetworkManager] Connection error:', err.message);
      this.emitInternal('connect_error', { message: err.message });
    });

    // Server authoritative event listeners
    this.socket.on('ROOM_CREATED', (data: { room: NetworkRoom; player: NetworkPlayer }) => {
      this.currentRoom = data.room;
      this.localPlayerId = data.player.id;
      this.localPlayerName = data.player.name;
      console.log(`[NetworkManager] ROOM_CREATED: ${data.room.code}`);
      this.emitInternal('ROOM_CREATED', data);
    });

    this.socket.on('ROOM_JOINED', (data: { room: NetworkRoom; player: NetworkPlayer }) => {
      this.currentRoom = data.room;
      this.localPlayerId = data.player.id;
      this.localPlayerName = data.player.name;
      console.log(`[NetworkManager] ROOM_JOINED: ${data.room.code}`);
      this.emitInternal('ROOM_JOINED', data);
    });

    this.socket.on('ROOM_UPDATED', (data: { room: NetworkRoom }) => {
      this.currentRoom = data.room;
      console.log(`[NetworkManager] ROOM_UPDATED: ${data.room.code} (${data.room.players.length} players)`);
      this.emitInternal('ROOM_UPDATED', data);
    });

    this.socket.on('PLAYER_JOINED', (data: { player: NetworkPlayer; room: NetworkRoom }) => {
      this.currentRoom = data.room;
      console.log(`[NetworkManager] PLAYER_JOINED: ${data.player.name}`);
      this.emitInternal('PLAYER_JOINED', data);
    });

    this.socket.on('PLAYER_LEFT', (data: { playerId: string; playerName: string; room: NetworkRoom }) => {
      this.currentRoom = data.room;
      console.log(`[NetworkManager] PLAYER_LEFT: ${data.playerName}`);
      this.emitInternal('PLAYER_LEFT', data);
    });

    this.socket.on('HOST_CHANGED', (data: { newHostId: string; newHostName: string }) => {
      console.log(`[NetworkManager] HOST_CHANGED: New Host is ${data.newHostName}`);
      this.emitInternal('HOST_CHANGED', data);
    });

    this.socket.on('GAME_STARTING', (data: { roomCode: string; countdown: number }) => {
      console.log(`[NetworkManager] GAME_STARTING: countdown=${data.countdown}`);
      this.emitInternal('GAME_STARTING', data);
    });

    this.socket.on('COUNTDOWN_TICK', (data: { roomCode: string; count: number | string }) => {
      console.log(`[NetworkManager] COUNTDOWN_TICK: ${data.count}`);
      this.emitInternal('COUNTDOWN_TICK', data);
    });

    this.socket.on('COUNTDOWN_CANCELLED', (data: { reason: string }) => {
      console.warn(`[NetworkManager] COUNTDOWN_CANCELLED: ${data.reason}`);
      this.emitInternal('COUNTDOWN_CANCELLED', data);
    });

    this.socket.on('GAME_STARTED', (data: { roomCode: string; status: string; players?: NetworkPlayer[] }) => {
      console.log(`[NetworkManager] GAME_STARTED: status=${data.status}`);
      if (this.currentRoom) {
        this.currentRoom.status = 'PLAYING';
      }
      this.emitInternal('GAME_STARTED', data);
    });

    this.socket.on('PLAYERS_INITIAL_STATE', (data: { players: NetworkPlayer[] }) => {
      console.log(`[NetworkManager] PLAYERS_INITIAL_STATE: ${data.players.length} players`);
      this.emitInternal('PLAYERS_INITIAL_STATE', data);
    });

    this.socket.on('PLAYER_JOINED_GAME', (data: { player: NetworkPlayer }) => {
      console.log(`[NetworkManager] PLAYER_JOINED_GAME: ${data.player.name}`);
      this.emitInternal('PLAYER_JOINED_GAME', data);
    });

    this.socket.on('PLAYER_UPDATED', (data: { id: string; position: Vector3D; rotation: Vector3D }) => {
      this.emitInternal('PLAYER_UPDATED', data);
    });

    this.socket.on('PLAYER_LEFT_GAME', (data: { id: string; playerName?: string }) => {
      console.log(`[NetworkManager] PLAYER_LEFT_GAME: ${data.playerName || data.id}`);
      this.emitInternal('PLAYER_LEFT_GAME', data);
    });

    // Phase 9: Authoritative Alien AI & Earth Core Synchronization
    this.socket.on('ALIEN_UPDATED', (data: {
      position: Vector3D;
      rotation: Vector3D;
      state: string;
      targetCoreId: string | null;
      collectedCores: number;
      extractionProgress: number;
    }) => {
      this.emitInternal('ALIEN_UPDATED', data);
    });

    this.socket.on('EARTH_CORE_COLLECTED', (data: {
      coreId: string;
      coreName: string;
      collectedCores: number;
      totalCores: number;
    }) => {
      console.log(`[NetworkManager] EARTH_CORE_COLLECTED: ${data.coreName} (${data.collectedCores}/${data.totalCores})`);
      this.emitInternal('EARTH_CORE_COLLECTED', data);
    });

    this.socket.on('SHUKA_CORE_COLLECTED', (data: {
      coreId: string;
      humanProgress: number;
      totalCores: number;
    }) => {
      console.log(`[NetworkManager] SHUKA_CORE_COLLECTED: ${data.coreId} (${data.humanProgress}/${data.totalCores})`);
      this.emitInternal('SHUKA_CORE_COLLECTED', data);
    });

    this.socket.on('MATCH_FINISHED', (data: {
      winner: 'HUMAN' | 'ALIEN';
      humanProgress: number;
      alienProgress: number;
      reason?: string;
    }) => {
      console.log(`[NetworkManager] MATCH_FINISHED: Winner = ${data.winner}`, data);
      if (this.currentRoom) {
        this.currentRoom.status = 'FINISHED';
      }
      this.emitInternal('MATCH_FINISHED', data);
    });

    this.socket.on('GAME_STATE_SYNC', (data: any) => {
      this.emitInternal('GAME_STATE_SYNC', data);
    });

    // Phase 10: Specialist Allocation System
    this.socket.on(
      'SPECIALIST_ALLOCATION_PHASE',
      (data: { roomCode: string; specialists: SpecialistAllocation }) => {
        console.log('[NetworkManager] SPECIALIST_ALLOCATION_PHASE:', data);
        if (this.currentRoom) {
          this.currentRoom.status = 'SPECIALIST_ALLOCATION';
        }
        if (data.specialists) {
          this.specialists = { ...data.specialists };
        }
        this.emitInternal('SPECIALIST_ALLOCATION_PHASE', data);
      }
    );

    this.socket.on(
      'SPECIALIST_ALLOCATION_UPDATED',
      (data: {
        roomCode: string;
        earthDefense: number;
        shukaExtraction: number;
        total: number;
        specialists: SpecialistAllocation;
      }) => {
        console.log('[NetworkManager] SPECIALIST_ALLOCATION_UPDATED:', data);
        if (data.specialists) {
          this.specialists = { ...data.specialists };
        } else {
          this.specialists.earthDefense = data.earthDefense;
          this.specialists.shukaExtraction = data.shukaExtraction;
          this.specialists.total = data.total;
        }
        this.emitInternal('SPECIALIST_ALLOCATION_UPDATED', data);
      }
    );

    this.socket.on(
      'SPECIALIST_ALLOCATION_CONFIRMED',
      (data: {
        roomCode: string;
        specialists: SpecialistAllocation;
        modifiers: any;
      }) => {
        console.log('[NetworkManager] SPECIALIST_ALLOCATION_CONFIRMED:', data);
        if (this.currentRoom) {
          this.currentRoom.status = 'PLAYING';
        }
        if (data.specialists) {
          this.specialists = { ...data.specialists, isLocked: true };
        }
        this.emitInternal('SPECIALIST_ALLOCATION_CONFIRMED', data);
      }
    );

    this.socket.on('SPECIALIST_ALLOCATION_ERROR', (data: { message: string }) => {
      console.warn('[NetworkManager] SPECIALIST_ALLOCATION_ERROR:', data.message);
      this.emitInternal('SPECIALIST_ALLOCATION_ERROR', data);
    });

    this.socket.on('ROOM_ERROR', (data: { message: string }) => {
      console.error(`[NetworkManager] ROOM_ERROR: ${data.message}`);
      this.emitInternal('ROOM_ERROR', data);
    });

    // Phase 11: Player Abilities
    this.socket.on('ABILITY_ACTIVATED', (data: any) => {
      console.log('[NetworkManager] ABILITY_ACTIVATED:', data);
      this.emitInternal('ABILITY_ACTIVATED', data);
    });

    this.socket.on('ABILITY_COOLDOWN_STARTED', (data: any) => {
      console.log('[NetworkManager] ABILITY_COOLDOWN_STARTED:', data);
      this.emitInternal('ABILITY_COOLDOWN_STARTED', data);
    });

    this.socket.on('ABILITY_REJECTED', (data: any) => {
      console.warn('[NetworkManager] ABILITY_REJECTED:', data);
      this.emitInternal('ABILITY_REJECTED', data);
    });

    this.socket.on('EMP_STATE_UPDATED', (data: any) => {
      this.emitInternal('EMP_STATE_UPDATED', data);
    });

    this.socket.on('OVERCHARGE_STATE_UPDATED', (data: any) => {
      this.emitInternal('OVERCHARGE_STATE_UPDATED', data);
    });

    this.socket.on('SCAN_RESULT', (data: any) => {
      console.log('[NetworkManager] SCAN_RESULT:', data);
      this.emitInternal('SCAN_RESULT', data);
    });

    return this.socket;
  }

  /**
   * Phase 11: Dispatch ability request to authoritative server
   */
  public sendUseAbility(ability: string, position?: { x: number; y: number; z: number }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('USE_ABILITY', { ability, position });
  }

  /**
   * Send throttled player movement/rotation update to the server
   */
  public sendPlayerUpdate(update: { position: Vector3D; rotation: Vector3D }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('PLAYER_UPDATE', update);
  }

  /**
   * Notify server that human operative collected a Shuka energy core
   */
  public sendShukaCoreCollected(coreId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('SHUKA_CORE_COLLECTED', { coreId });
  }

  /**
   * Request full game state sync
   */
  public requestGameState(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('GET_GAME_STATE');
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  public get localPlayer(): NetworkPlayer | null {
    if (!this.currentRoom || !this.localPlayerId) return null;
    return this.currentRoom.players.find((p) => p.id === this.localPlayerId) || null;
  }

  public get isHost(): boolean {
    const player = this.localPlayer;
    return player ? player.isHost : false;
  }

  /**
   * Request room creation from server
   */
  public async createRoom(playerName: string): Promise<{ success: boolean; room?: NetworkRoom; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not initialized' });
        return;
      }
      this.localPlayerName = playerName;
      this.socket.emit('CREATE_ROOM', { playerName }, (response: any) => {
        if (response && response.success) {
          this.currentRoom = response.room;
          resolve({ success: true, room: response.room });
        } else {
          resolve({ success: false, error: response?.error || 'Failed to create room' });
        }
      });
    });
  }

  /**
   * Request joining an existing room
   */
  public async joinRoom(
    playerName: string,
    roomCode: string
  ): Promise<{ success: boolean; room?: NetworkRoom; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not initialized' });
        return;
      }
      this.localPlayerName = playerName;
      this.socket.emit('JOIN_ROOM', { playerName, roomCode }, (response: any) => {
        if (response && response.success) {
          this.currentRoom = response.room;
          resolve({ success: true, room: response.room });
        } else {
          resolve({ success: false, error: response?.error || 'Failed to join room' });
        }
      });
    });
  }

  /**
   * Toggle or set ready state
   */
  public async setReady(ready?: boolean): Promise<{ success: boolean; ready?: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not initialized' });
        return;
      }
      this.socket.emit('SET_READY', { ready }, (response: any) => {
        if (response && response.success) {
          if (response.room) this.currentRoom = response.room;
          resolve({ success: true, ready: response.ready });
        } else {
          resolve({ success: false, error: response?.error || 'Failed to set ready' });
        }
      });
    });
  }

  /**
   * Host requests match start
   */
  public async startGame(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not initialized' });
        return;
      }
      this.socket.emit('START_GAME', {}, (response: any) => {
        if (response && response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response?.error || 'Failed to start game' });
        }
      });
    });
  }

  /**
   * Host updates team specialist allocation
   */
  public async setSpecialistAllocation(
    earthDefense: number,
    shukaExtraction: number
  ): Promise<{ success: boolean; error?: string; specialists?: SpecialistAllocation }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not connected' });
        return;
      }
      this.socket.emit(
        'SET_SPECIALIST_ALLOCATION',
        { earthDefense, shukaExtraction },
        (res: any) => {
          if (res && res.success) {
            if (res.specialists) {
              this.specialists = { ...res.specialists };
            }
            resolve({ success: true, specialists: res.specialists });
          } else {
            resolve({ success: false, error: res?.error || 'Failed to set specialist allocation' });
          }
        }
      );
    });
  }

  /**
   * Host confirms and locks team specialist allocation
   */
  public async confirmSpecialistAllocation(): Promise<{
    success: boolean;
    error?: string;
    payload?: any;
  }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Network not connected' });
        return;
      }
      this.socket.emit('CONFIRM_SPECIALIST_ALLOCATION', {}, (res: any) => {
        if (res && res.success) {
          if (res.payload?.specialists) {
            this.specialists = { ...res.payload.specialists, isLocked: true };
          }
          resolve({ success: true, payload: res.payload });
        } else {
          resolve({
            success: false,
            error: res?.error || 'Failed to confirm specialist allocation'
          });
        }
      });
    });
  }

  /**
   * Leave current room
   */
  public async leaveRoom(): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.currentRoom) {
        this.currentRoom = null;
        resolve({ success: true });
        return;
      }
      this.socket.emit('LEAVE_ROOM', {}, () => {
        this.currentRoom = null;
        this.emitInternal('ROOM_LEFT', {});
        resolve({ success: true });
      });
    });
  }

  public on(event: string, callback: NetworkEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emitInternal(event: string, data: any): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[NetworkManager] Error in event listener '${event}':`, err);
        }
      }
    }
  }

  public get socketId(): string | null {
    return this.socket?.id || this.localPlayerId;
  }

  /**
   * Requests return to lobby for a rematch
   */
  public async requestRematch(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.currentRoom) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }
      this.socket.emit('REQUEST_REMATCH', {}, (res: any) => {
        if (res && res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res?.error || 'Failed to request rematch' });
        }
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }
}

