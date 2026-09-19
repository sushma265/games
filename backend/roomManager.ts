import { Server, Socket } from 'socket.io';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Player {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  position: Vector3D;
  rotation: Vector3D;
}

export type RoomStatus = 'LOBBY' | 'STARTING' | 'SPECIALIST_ALLOCATION' | 'PLAYING' | 'FINISHED';

export interface SpecialistAllocation {
  total: number;
  earthDefense: number;
  shukaExtraction: number;
  isLocked: boolean;
}

export const SPECIALIST_CONFIG = {
  total: 5,
  defaultEarthDefense: 2,
  defaultShukaExtraction: 3,
  shukaExtractionBonusPerSpecialist: 0.05,
  earthDefenseBonusPerSpecialist: 0.05,
  baseShukaExtractionTime: 4.0
};

export type AlienAIState = 'IDLE' | 'SEARCHING' | 'MOVING' | 'EXTRACTING' | 'CORE_COLLECTED';

export interface EarthCoreData {
  id: string;
  name: string;
  position: Vector3D;
  collected: boolean;
  extracting: boolean;
}

export interface AlienAIData {
  position: Vector3D;
  rotation: Vector3D;
  state: AlienAIState;
  targetCoreId: string | null;
  extractionProgress: number; // 0.0 to 1.0
  collectedCores: number;
  empDisabledUntil?: number; // ms timestamp
  overchargeDisruptedUntil?: number; // ms timestamp
}

// Phase 11: Centralized Ability & Game Balance Configuration
export type AbilityId = 'EMP_SURGE' | 'OVERCHARGE' | 'SCAN';

export const GAME_BALANCE = {
  specialists: {
    earthDefenseBonusPerSpecialist: 0.05,
    shukaExtractionBonusPerSpecialist: 0.05
  },
  abilities: {
    empDuration: 5,
    empCooldown: 20,
    overchargeDuration: 2,
    overchargeCooldown: 25,
    overchargeBaseReduction: 0.25,
    scanDuration: 5,
    scanCooldown: 15
  }
};

export class ServerAbilityCooldownManager {
  private cooldowns: Map<string, number> = new Map();
  private activeUntil: Map<string, number> = new Map();

  public canUse(ability: string): boolean {
    return this.getRemaining(ability) <= 0;
  }

  public startCooldown(ability: string, cooldownDuration: number, activeDuration: number = 0): void {
    const now = Date.now();
    this.cooldowns.set(ability, now + cooldownDuration * 1000);
    if (activeDuration > 0) {
      this.activeUntil.set(ability, now + activeDuration * 1000);
    }
  }

  public getRemaining(ability: string): number {
    const end = this.cooldowns.get(ability);
    if (!end) return 0;
    const now = Date.now();
    const remaining = (end - now) / 1000;
    return remaining > 0 ? remaining : 0;
  }

  public getActiveRemaining(ability: string): number {
    const end = this.activeUntil.get(ability);
    if (!end) return 0;
    const now = Date.now();
    const remaining = (end - now) / 1000;
    return remaining > 0 ? remaining : 0;
  }

  public isEffectActive(ability: string): boolean {
    return this.getActiveRemaining(ability) > 0;
  }

  public reset(): void {
    this.cooldowns.clear();
    this.activeUntil.clear();
  }
}

export const SHUKA_CORES = [
  { id: 'shuka-core-1', name: 'Shuka Core 1', position: { x: 0, y: 1.8, z: 22 } },
  { id: 'shuka-core-2', name: 'Shuka Core 2', position: { x: 38, y: 2.2, z: 12 } },
  { id: 'shuka-core-3', name: 'Shuka Core 3', position: { x: -32, y: 2.0, z: 30 } },
  { id: 'shuka-core-4', name: 'Shuka Core 4', position: { x: 26, y: 2.5, z: -34 } },
  { id: 'shuka-core-5', name: 'Shuka Core 5', position: { x: -36, y: 2.2, z: -26 } }
];

export const INITIAL_EARTH_CORES: EarthCoreData[] = [
  { id: 'earth-core-1', name: 'CRASH SITE ALPHA', position: { x: 0, y: 1.5, z: 18 }, collected: false, extracting: false },
  { id: 'earth-core-2', name: 'SKYSCRAPER RUIN BETA', position: { x: 28, y: 1.5, z: 8 }, collected: false, extracting: false },
  { id: 'earth-core-3', name: 'HIGHWAY OVERPASS GAMMA', position: { x: -24, y: 1.5, z: 22 }, collected: false, extracting: false },
  { id: 'earth-core-4', name: 'DEFENSE DEPOT DELTA', position: { x: 20, y: 1.5, z: -26 }, collected: false, extracting: false },
  { id: 'earth-core-5', name: 'GRID SUBSTATION EPSILON', position: { x: -28, y: 1.5, z: -18 }, collected: false, extracting: false }
];

export const ALIEN_CONFIG = {
  speed: 3.2,             // Configurable movement speed (m/s)
  extractionDuration: 5.0, // Configurable extraction time (5.0 seconds)
  arrivalDistance: 1.8,    // Distance threshold to trigger extraction
  updateIntervalMs: 100    // 10 Hz authoritative simulation loop
};

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  players: Player[];
  countdownTimer?: NodeJS.Timeout | null;
  countdownValue?: number;
  humanProgress: number;
  alienProgress: number;
  collectedShukaCoreIds: Set<string>;
  earthCores: EarthCoreData[];
  alien: AlienAIData;
  aiUpdateTimer?: NodeJS.Timeout | null;
  specialists: SpecialistAllocation;
  playerCooldowns: Map<string, ServerAbilityCooldownManager>;
}

export const SHUKA_SPAWN_POINTS: Vector3D[] = [
  { x: 0, y: 1.2, z: 0 },
  { x: 4, y: 1.2, z: 0 },
  { x: -4, y: 1.2, z: 0 },
  { x: 0, y: 1.2, z: 4 }
];

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  // Socket ID -> Room Code mapping for fast lookup on disconnect
  private playerRoomMap: Map<string, string> = new Map();
  private io: Server;

  // Unambiguous characters for 6-character room codes (no 0/O, 1/I/L)
  private static readonly CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  private static readonly CODE_LENGTH = 6;
  public static readonly MAX_PLAYERS = 4;
  public static readonly MIN_PLAYERS_TO_START = 2;

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Generates a unique 6-character room code
   */
  public generateRoomCode(): string {
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < RoomManager.CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * RoomManager.CHARSET.length);
        code += RoomManager.CHARSET[randomIndex];
      }
      attempts++;
      if (attempts > 1000) {
        throw new Error('Failed to generate unique room code');
      }
    } while (this.rooms.has(code));

    return code;
  }

  /**
   * Sanitizes player name to avoid HTML/script injection
   */
  public sanitizeName(name: unknown): string {
    if (typeof name !== 'string') return '';
    const cleaned = name
      .trim()
      .replace(/[<>&"'/`]/g, '')
      .replace(/\s+/g, ' ');
    return cleaned.slice(0, 16);
  }

  /**
   * Normalizes room code to uppercase and trimmed
   */
  public normalizeCode(code: unknown): string {
    if (typeof code !== 'string') return '';
    return code.trim().toUpperCase();
  }

  /**
   * Socket.IO connection and event listener setup
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);

      // 1. CREATE_ROOM
      socket.on('CREATE_ROOM', (data: { playerName?: string }, callback?: (res: any) => void) => {
        try {
          const playerName = this.sanitizeName(data?.playerName);
          if (playerName.length < 2 || playerName.length > 16) {
            const err = 'ENTER YOUR NAME (2-16 characters)';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          // If player was in an existing room, leave first
          this.handleLeave(socket);

          const roomCode = this.generateRoomCode();
          const hostPlayer: Player = {
            id: socket.id,
            name: playerName,
            ready: true, // Host is ready by default
            isHost: true,
            position: { ...SHUKA_SPAWN_POINTS[0] },
            rotation: { x: 0, y: 0, z: 0 }
          };

          const room: Room = {
            code: roomCode,
            hostId: socket.id,
            status: 'LOBBY',
            maxPlayers: RoomManager.MAX_PLAYERS,
            players: [hostPlayer],
            countdownTimer: null,
            humanProgress: 0,
            alienProgress: 0,
            collectedShukaCoreIds: new Set(),
            earthCores: INITIAL_EARTH_CORES.map((c) => ({ ...c, position: { ...c.position } })),
            alien: {
              position: { x: 0, y: 1.5, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              state: 'IDLE',
              targetCoreId: null,
              extractionProgress: 0,
              collectedCores: 0
            },
            aiUpdateTimer: null,
            specialists: {
              total: SPECIALIST_CONFIG.total,
              earthDefense: SPECIALIST_CONFIG.defaultEarthDefense,
              shukaExtraction: SPECIALIST_CONFIG.defaultShukaExtraction,
              isLocked: false
            },
            playerCooldowns: new Map([[socket.id, new ServerAbilityCooldownManager()]])
          };

          this.rooms.set(roomCode, room);
          this.playerRoomMap.set(socket.id, roomCode);

          socket.join(roomCode);

          console.log(`[RoomManager] Room created: ${roomCode} by ${playerName} (${socket.id})`);

          const sanitizedRoom = this.serializeRoom(room);
          const response = {
            success: true,
            room: sanitizedRoom,
            player: hostPlayer
          };

          socket.emit('ROOM_CREATED', response);
          if (callback) callback(response);
        } catch (err: any) {
          console.error('[RoomManager] Error creating room:', err);
          const msg = err?.message || 'Failed to create room';
          socket.emit('ROOM_ERROR', { message: msg });
          if (callback) callback({ success: false, error: msg });
        }
      });

      // 2. JOIN_ROOM
      socket.on(
        'JOIN_ROOM',
        (data: { playerName?: string; roomCode?: string }, callback?: (res: any) => void) => {
          try {
            const playerName = this.sanitizeName(data?.playerName);
            if (playerName.length < 2 || playerName.length > 16) {
              const err = 'ENTER YOUR NAME (2-16 characters)';
              socket.emit('ROOM_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            const rawCode = data?.roomCode;
            if (!rawCode) {
              const err = 'ENTER ROOM CODE';
              socket.emit('ROOM_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            const roomCode = this.normalizeCode(rawCode);
            const room = this.rooms.get(roomCode);

            if (!room) {
              const err = 'ROOM NOT FOUND';
              socket.emit('ROOM_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            if (room.status !== 'LOBBY') {
              const err = 'MISSION ALREADY STARTED';
              socket.emit('ROOM_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            if (room.players.length >= room.maxPlayers) {
              const err = 'ROOM FULL';
              socket.emit('ROOM_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // If already in another room, leave it
            this.handleLeave(socket);

            const spawnIdx = room.players.length;
            const spawnPos = SHUKA_SPAWN_POINTS[spawnIdx % SHUKA_SPAWN_POINTS.length];
            const newPlayer: Player = {
              id: socket.id,
              name: playerName,
              ready: false,
              isHost: false,
              position: { ...spawnPos },
              rotation: { x: 0, y: 0, z: 0 }
            };

            room.players.push(newPlayer);
            room.playerCooldowns.set(socket.id, new ServerAbilityCooldownManager());
            this.playerRoomMap.set(socket.id, roomCode);
            socket.join(roomCode);

            console.log(`[RoomManager] ${playerName} joined room ${roomCode} (${room.players.length}/${room.maxPlayers})`);

            const sanitizedRoom = this.serializeRoom(room);
            const response = {
              success: true,
              room: sanitizedRoom,
              player: newPlayer
            };

            socket.emit('ROOM_JOINED', response);
            // Notify others in room
            socket.to(roomCode).emit('PLAYER_JOINED', {
              player: newPlayer,
              room: sanitizedRoom
            });
            this.io.to(roomCode).emit('ROOM_UPDATED', { room: sanitizedRoom });

            if (callback) callback(response);
          } catch (err: any) {
            console.error('[RoomManager] Error joining room:', err);
            const msg = err?.message || 'Failed to join room';
            socket.emit('ROOM_ERROR', { message: msg });
            if (callback) callback({ success: false, error: msg });
          }
        }
      );

      // 3. SET_READY
      socket.on('SET_READY', (data: { ready?: boolean }, callback?: (res: any) => void) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) return;

          const room = this.rooms.get(roomCode);
          if (!room || room.status !== 'LOBBY') return;

          const player = room.players.find((p) => p.id === socket.id);
          if (!player) return;

          // Toggle or assign ready
          player.ready = typeof data?.ready === 'boolean' ? data.ready : !player.ready;

          const sanitizedRoom = this.serializeRoom(room);
          this.io.to(roomCode).emit('ROOM_UPDATED', { room: sanitizedRoom });

          if (callback) callback({ success: true, ready: player.ready, room: sanitizedRoom });
        } catch (err) {
          console.error('[RoomManager] Error in SET_READY:', err);
        }
      });

      // 4. START_GAME (Host only)
      socket.on('START_GAME', (_data: unknown, callback?: (res: any) => void) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) {
            const err = 'ROOM NOT FOUND';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          const room = this.rooms.get(roomCode);
          if (!room) {
            const err = 'ROOM NOT FOUND';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          // Authoritative validation
          if (room.hostId !== socket.id) {
            const err = 'Only host can start the mission';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.status !== 'LOBBY') {
            const err = 'Mission already starting or active';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.players.length < RoomManager.MIN_PLAYERS_TO_START) {
            const err = `At least ${RoomManager.MIN_PLAYERS_TO_START} players required to start`;
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          const allReady = room.players.every((p) => p.ready);
          if (!allReady) {
            const err = 'All players must be ready';
            socket.emit('ROOM_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          // Begin synchronized countdown sequence
          room.status = 'STARTING';
          room.countdownValue = 3;

          console.log(`[RoomManager] Room ${roomCode} starting countdown!`);

          this.io.to(roomCode).emit('GAME_STARTING', {
            roomCode,
            countdown: 3
          });
          this.io.to(roomCode).emit('ROOM_UPDATED', { room: this.serializeRoom(room) });

          if (callback) callback({ success: true });

          // Synchronized countdown: 3 -> 2 -> 1 -> GO -> PLAYING
          let count = 3;
          room.countdownTimer = setInterval(() => {
            count--;
            room.countdownValue = count;

            if (count > 0) {
              this.io.to(roomCode).emit('COUNTDOWN_TICK', {
                roomCode,
                count
              });
            } else if (count === 0) {
              this.io.to(roomCode).emit('COUNTDOWN_TICK', {
                roomCode,
                count: 'GO'
              });
            } else {
              // Finish countdown -> SPECIALIST_ALLOCATION
              if (room.countdownTimer) {
                clearInterval(room.countdownTimer);
                room.countdownTimer = null;
              }
              room.status = 'SPECIALIST_ALLOCATION';

              console.log(
                `[RoomManager] Room ${roomCode} countdown complete. Transitioned to SPECIALIST_ALLOCATION phase.`
              );

              this.io.to(roomCode).emit('SPECIALIST_ALLOCATION_PHASE', {
                roomCode,
                specialists: { ...room.specialists }
              });
              this.io.to(roomCode).emit('ROOM_UPDATED', { room: this.serializeRoom(room) });
            }
          }, 1000);
        } catch (err: any) {
          console.error('[RoomManager] Error starting game:', err);
          const msg = err?.message || 'Failed to start game';
          socket.emit('ROOM_ERROR', { message: msg });
          if (callback) callback({ success: false, error: msg });
        }
      });

      // 5. SET_SPECIALIST_ALLOCATION (Host modifies specialist distribution)
      socket.on(
        'SET_SPECIALIST_ALLOCATION',
        (
          data: { earthDefense?: number; shukaExtraction?: number },
          callback?: (res: any) => void
        ) => {
          try {
            const roomCode = this.playerRoomMap.get(socket.id);
            if (!roomCode) {
              const err = 'ROOM NOT FOUND';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            const room = this.rooms.get(roomCode);
            if (!room) {
              const err = 'ROOM NOT FOUND';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // 1. Sender is host
            if (room.hostId !== socket.id) {
              const err = 'Only the host can modify specialist allocation';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // 3. Room is in correct state
            if (room.status !== 'SPECIALIST_ALLOCATION') {
              const err = 'Specialists can only be allocated during the allocation phase';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            if (room.specialists.isLocked) {
              const err = 'Specialist allocation is locked and cannot be modified';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            const earthDefense = data?.earthDefense;
            const shukaExtraction = data?.shukaExtraction;

            // 4 & 5. Integer check
            if (
              typeof earthDefense !== 'number' ||
              !Number.isInteger(earthDefense) ||
              typeof shukaExtraction !== 'number' ||
              !Number.isInteger(shukaExtraction)
            ) {
              const err = 'Specialist values must be integers';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // 6. Both values >= 0
            if (earthDefense < 0 || shukaExtraction < 0) {
              const err = 'Specialist values cannot be negative';
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            if (earthDefense > SPECIALIST_CONFIG.total || shukaExtraction > SPECIALIST_CONFIG.total) {
              const err = `Specialist count cannot exceed total (${SPECIALIST_CONFIG.total})`;
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // 7. earthDefense + shukaExtraction === 5
            if (earthDefense + shukaExtraction !== SPECIALIST_CONFIG.total) {
              const err = `Total specialists must equal exactly ${SPECIALIST_CONFIG.total} (received ${earthDefense + shukaExtraction})`;
              socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
              if (callback) callback({ success: false, error: err });
              return;
            }

            // Validation passed
            room.specialists.earthDefense = earthDefense;
            room.specialists.shukaExtraction = shukaExtraction;

            console.log(
              `[RoomManager] Room ${roomCode} specialist allocation updated: Earth Defense = ${earthDefense}, Shuka Extraction = ${shukaExtraction}`
            );

            const payload = {
              roomCode,
              total: SPECIALIST_CONFIG.total,
              earthDefense,
              shukaExtraction,
              specialists: { ...room.specialists }
            };

            // Broadcast to everyone in the room
            this.io.to(roomCode).emit('SPECIALIST_ALLOCATION_UPDATED', payload);
            this.io.to(roomCode).emit('ROOM_UPDATED', { room: this.serializeRoom(room) });

            if (callback) callback({ success: true, specialists: room.specialists });
          } catch (err: any) {
            console.error('[RoomManager] Error in SET_SPECIALIST_ALLOCATION:', err);
            const msg = err?.message || 'Failed to update specialist allocation';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: msg });
            if (callback) callback({ success: false, error: msg });
          }
        }
      );

      // 6. CONFIRM_SPECIALIST_ALLOCATION (Host confirms and locks specialists)
      socket.on('CONFIRM_SPECIALIST_ALLOCATION', (_data: unknown, callback?: (res: any) => void) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) {
            const err = 'ROOM NOT FOUND';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          const room = this.rooms.get(roomCode);
          if (!room) {
            const err = 'ROOM NOT FOUND';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.hostId !== socket.id) {
            const err = 'Only the host can confirm specialist allocation';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.status !== 'SPECIALIST_ALLOCATION') {
            const err = 'Room is not in specialist allocation phase';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.specialists.isLocked) {
            const err = 'Specialist allocation is already locked';
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          if (room.specialists.earthDefense + room.specialists.shukaExtraction !== SPECIALIST_CONFIG.total) {
            const err = `Total allocated specialists must equal ${SPECIALIST_CONFIG.total}`;
            socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: err });
            if (callback) callback({ success: false, error: err });
            return;
          }

          // Lock allocation and transition room to PLAYING
          room.specialists.isLocked = true;
          room.status = 'PLAYING';

          // Assign distinct spawn positions to players
          room.players.forEach((p, idx) => {
            p.position = { ...SHUKA_SPAWN_POINTS[idx % SHUKA_SPAWN_POINTS.length] };
            p.rotation = { x: 0, y: 0, z: 0 };
          });

          console.log(
            `[RoomManager] Room ${roomCode} CONFIRMED specialists: Earth=${room.specialists.earthDefense}, Shuka=${room.specialists.shukaExtraction}. Starting gameplay.`
          );

          // Start server-authoritative Alien AI on Earth
          this.startAuthoritativeAlienAI(room);

          const playersPayload = room.players.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            rotation: p.rotation
          }));

          const confirmedPayload = {
            roomCode,
            specialists: { ...room.specialists },
            modifiers: {
              earthDefenseBonus: room.specialists.earthDefense * SPECIALIST_CONFIG.earthDefenseBonusPerSpecialist,
              shukaExtractionBonus: room.specialists.shukaExtraction * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist,
              baseExtractionTime: SPECIALIST_CONFIG.baseShukaExtractionTime,
              finalExtractionTime:
                SPECIALIST_CONFIG.baseShukaExtractionTime /
                (1 + room.specialists.shukaExtraction * SPECIALIST_CONFIG.shukaExtractionBonusPerSpecialist)
            }
          };

          this.io.to(roomCode).emit('SPECIALIST_ALLOCATION_CONFIRMED', confirmedPayload);
          this.io.to(roomCode).emit('GAME_STARTED', {
            roomCode,
            status: 'PLAYING',
            players: playersPayload,
            specialists: room.specialists
          });
          this.io.to(roomCode).emit('PLAYERS_INITIAL_STATE', {
            players: playersPayload
          });
          this.io.to(roomCode).emit('ROOM_UPDATED', { room: this.serializeRoom(room) });

          if (callback) callback({ success: true, payload: confirmedPayload });
        } catch (err: any) {
          console.error('[RoomManager] Error confirming specialist allocation:', err);
          const msg = err?.message || 'Failed to confirm specialist allocation';
          socket.emit('SPECIALIST_ALLOCATION_ERROR', { message: msg });
          if (callback) callback({ success: false, error: msg });
        }
      });

      // 5. PLAYER_UPDATE (Real-Time Movement / Rotation)
      socket.on('PLAYER_UPDATE', (data: { position?: Vector3D; rotation?: Vector3D }) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) return;

          const room = this.rooms.get(roomCode);
          if (!room || room.status !== 'PLAYING') return;

          const player = room.players.find((p) => p.id === socket.id);
          if (!player) return;

          let updated = false;

          // Validate position (finite numbers, bounded within Shuka map coordinates)
          if (data && data.position) {
            const { x, y, z } = data.position;
            if (
              typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 500 &&
              typeof y === 'number' && Number.isFinite(y) && Math.abs(y) < 100 &&
              typeof z === 'number' && Number.isFinite(z) && Math.abs(z) < 500
            ) {
              player.position = { x, y, z };
              updated = true;
            }
          }

          // Validate rotation (Euler rotation coordinates)
          if (data && data.rotation) {
            const { x, y, z } = data.rotation;
            if (
              typeof x === 'number' && Number.isFinite(x) &&
              typeof y === 'number' && Number.isFinite(y) &&
              typeof z === 'number' && Number.isFinite(z)
            ) {
              player.rotation = { x, y, z };
              updated = true;
            }
          }

          if (updated) {
            // Strictly isolated to this room only; do NOT broadcast to sender
            socket.to(roomCode).emit('PLAYER_UPDATED', {
              id: socket.id,
              position: player.position,
              rotation: player.rotation
            });
          }
        } catch (err) {
          console.error('[RoomManager] Error in PLAYER_UPDATE:', err);
        }
      });

      socket.on('PLAYER_MOVE', (data: { position?: Vector3D; rotation?: Vector3D }) => {
        const roomCode = this.playerRoomMap.get(socket.id);
        if (!roomCode) return;
        const room = this.rooms.get(roomCode);
        if (!room || room.status !== 'PLAYING') return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return;
        if (data?.position) player.position = data.position;
        if (data?.rotation) player.rotation = data.rotation;
        socket.to(roomCode).emit('PLAYER_UPDATED', {
          id: socket.id,
          position: player.position,
          rotation: player.rotation
        });
      });

      // 6. SHUKA_CORE_COLLECTED (Human team collected a Shuka energy core)
      socket.on('SHUKA_CORE_COLLECTED', (data: { coreId: string }) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) return;
          const room = this.rooms.get(roomCode);
          if (!room || room.status !== 'PLAYING') return;

          if (data?.coreId && !room.collectedShukaCoreIds.has(data.coreId)) {
            room.collectedShukaCoreIds.add(data.coreId);
            room.humanProgress = Math.min(5, room.humanProgress + 1);

            console.log(`[RoomManager] Room ${roomCode}: Human collected ${data.coreId} (${room.humanProgress}/5)`);

            this.io.to(roomCode).emit('SHUKA_CORE_COLLECTED', {
              coreId: data.coreId,
              humanProgress: room.humanProgress,
              totalCores: 5
            });

            // Check Win condition (Humans reach 5 cores)
            if (room.humanProgress >= 5) {
              room.status = 'FINISHED';
              this.stopAuthoritativeAlienAI(room);
              this.io.to(roomCode).emit('MATCH_FINISHED', {
                winner: 'HUMAN',
                humanProgress: room.humanProgress,
                alienProgress: room.alienProgress,
                reason: 'Humans secured 5 Shuka Energy Cores'
              });
            }
          }
        } catch (err) {
          console.error('[RoomManager] Error in SHUKA_CORE_COLLECTED:', err);
        }
      });

      // 7. USE_ABILITY (Phase 11: Authoritative Abilities)
      socket.on(
        'USE_ABILITY',
        (data: { ability: string; position?: Vector3D }, callback?: (res: any) => void) => {
          try {
            const roomCode = this.playerRoomMap.get(socket.id);
            if (!roomCode) {
              const reason = 'Player not in room';
              socket.emit('ABILITY_REJECTED', { ability: data?.ability, reason });
              if (callback) callback({ success: false, reason });
              return;
            }

            const room = this.rooms.get(roomCode);
            if (!room || room.status !== 'PLAYING') {
              const reason = 'Game not started';
              socket.emit('ABILITY_REJECTED', { ability: data?.ability, reason });
              if (callback) callback({ success: false, reason });
              return;
            }

            const player = room.players.find((p) => p.id === socket.id);
            if (!player) {
              const reason = 'Player not found in room';
              socket.emit('ABILITY_REJECTED', { ability: data?.ability, reason });
              if (callback) callback({ success: false, reason });
              return;
            }

            // Normalize ability
            let abilityId: AbilityId | null = null;
            const raw = String(data?.ability || '').toUpperCase().trim();
            if (raw === 'EMP_SURGE' || raw === 'EMPSURGE' || raw === 'EMP') abilityId = 'EMP_SURGE';
            else if (raw === 'OVERCHARGE') abilityId = 'OVERCHARGE';
            else if (raw === 'SCAN') abilityId = 'SCAN';

            if (!abilityId) {
              const reason = 'Invalid ability name';
              socket.emit('ABILITY_REJECTED', { ability: data?.ability, reason });
              if (callback) callback({ success: false, reason });
              return;
            }

            let cooldownMgr = room.playerCooldowns.get(socket.id);
            if (!cooldownMgr) {
              cooldownMgr = new ServerAbilityCooldownManager();
              room.playerCooldowns.set(socket.id, cooldownMgr);
            }

            if (!cooldownMgr.canUse(abilityId)) {
              const remaining = Math.ceil(cooldownMgr.getRemaining(abilityId));
              const reason = `Ability on cooldown (${remaining}s remaining)`;
              socket.emit('ABILITY_REJECTED', { ability: abilityId, reason });
              if (callback) callback({ success: false, reason });
              return;
            }

            // Specialist modifier interaction (Phase 10 integration)
            const edSpecialists = room.specialists?.earthDefense ?? 2;
            const edBonus = edSpecialists * GAME_BALANCE.specialists.earthDefenseBonusPerSpecialist;

            if (abilityId === 'EMP_SURGE') {
              // EMP pauses alien extraction if active
              if (room.alien.state !== 'EXTRACTING') {
                const reason = 'Alien Harvester is not currently extracting an Earth Core';
                socket.emit('ABILITY_REJECTED', { ability: abilityId, reason });
                if (callback) callback({ success: false, reason });
                return;
              }

              const duration = GAME_BALANCE.abilities.empDuration;
              const cooldown = GAME_BALANCE.abilities.empCooldown;
              cooldownMgr.startCooldown(abilityId, cooldown, duration);

              const until = Date.now() + duration * 1000;
              room.alien.empDisabledUntil = until;

              console.log(
                `[RoomManager] Room ${roomCode}: ${player.name} activated EMP SURGE. Alien extraction paused for ${duration}s.`
              );

              this.io.to(roomCode).emit('ABILITY_ACTIVATED', {
                playerId: socket.id,
                playerName: player.name,
                ability: 'EMP_SURGE',
                duration,
                cooldown
              });

              socket.emit('ABILITY_COOLDOWN_STARTED', {
                ability: 'EMP_SURGE',
                cooldown,
                duration
              });

              this.io.to(roomCode).emit('EMP_STATE_UPDATED', {
                active: true,
                duration,
                until
              });

              if (callback) callback({ success: true, ability: 'EMP_SURGE', duration, cooldown });
              return;
            }

            if (abilityId === 'OVERCHARGE') {
              // Overcharge disrupts alien extraction and sets back progress
              if (room.alien.state !== 'EXTRACTING') {
                const reason = 'Alien Harvester is not currently extracting an Earth Core';
                socket.emit('ABILITY_REJECTED', { ability: abilityId, reason });
                if (callback) callback({ success: false, reason });
                return;
              }

              const duration = GAME_BALANCE.abilities.overchargeDuration;
              const cooldown = GAME_BALANCE.abilities.overchargeCooldown;
              const setback = GAME_BALANCE.abilities.overchargeBaseReduction * (1 + edBonus);

              room.alien.extractionProgress = Math.max(0, room.alien.extractionProgress - setback);
              const until = Date.now() + duration * 1000;
              room.alien.overchargeDisruptedUntil = until;

              cooldownMgr.startCooldown(abilityId, cooldown, duration);

              console.log(
                `[RoomManager] Room ${roomCode}: ${player.name} activated OVERCHARGE (setback=${setback.toFixed(2)}, progress=${room.alien.extractionProgress.toFixed(2)})`
              );

              this.io.to(roomCode).emit('ABILITY_ACTIVATED', {
                playerId: socket.id,
                playerName: player.name,
                ability: 'OVERCHARGE',
                duration,
                cooldown,
                setback
              });

              socket.emit('ABILITY_COOLDOWN_STARTED', {
                ability: 'OVERCHARGE',
                cooldown,
                duration
              });

              this.io.to(roomCode).emit('OVERCHARGE_STATE_UPDATED', {
                active: true,
                duration,
                setback,
                until
              });

              if (callback) callback({ success: true, ability: 'OVERCHARGE', duration, cooldown, setback });
              return;
            }

            if (abilityId === 'SCAN') {
              // Find nearest uncollected Shuka Core
              const uncollectedCores = SHUKA_CORES.filter((c) => !room.collectedShukaCoreIds.has(c.id));
              if (uncollectedCores.length === 0) {
                const reason = 'All Shuka Energy Cores have already been collected';
                socket.emit('ABILITY_REJECTED', { ability: abilityId, reason });
                if (callback) callback({ success: false, reason });
                return;
              }

              const duration = GAME_BALANCE.abilities.scanDuration;
              const cooldown = GAME_BALANCE.abilities.scanCooldown;
              cooldownMgr.startCooldown(abilityId, cooldown, duration);

              const playerPos = data?.position || player.position || { x: 0, y: 1.2, z: 0 };
              let closestCore = uncollectedCores[0];
              let minDistance = Infinity;

              for (const core of uncollectedCores) {
                const dx = core.position.x - playerPos.x;
                const dz = core.position.z - playerPos.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < minDistance) {
                  minDistance = d;
                  closestCore = core;
                }
              }

              console.log(
                `[RoomManager] Room ${roomCode}: ${player.name} activated SCAN -> ${closestCore.name} (${minDistance.toFixed(1)}m away)`
              );

              // Broadcast general activation to all players
              this.io.to(roomCode).emit('ABILITY_ACTIVATED', {
                playerId: socket.id,
                playerName: player.name,
                ability: 'SCAN',
                duration,
                cooldown
              });

              socket.emit('ABILITY_COOLDOWN_STARTED', {
                ability: 'SCAN',
                cooldown,
                duration
              });

              // Send scan highlight result ONLY to the activating player (Section 19)
              socket.emit('SCAN_RESULT', {
                targetCoreId: closestCore.id,
                targetCoreName: closestCore.name,
                duration,
                distance: minDistance
              });

              if (callback) callback({ success: true, targetCoreId: closestCore.id, distance: minDistance });
              return;
            }
          } catch (err) {
            console.error('[RoomManager] Error in USE_ABILITY:', err);
            socket.emit('ABILITY_REJECTED', { ability: data?.ability, reason: 'Internal server error' });
            if (callback) callback({ success: false, reason: 'Internal server error' });
          }
        }
      );

      // 8. GET_GAME_STATE (State recovery or late-join sync)
      socket.on('GET_GAME_STATE', (_data: unknown, callback?: (res: any) => void) => {
        const roomCode = this.playerRoomMap.get(socket.id);
        if (!roomCode) return;
        const room = this.rooms.get(roomCode);
        if (!room) return;

        const payload = {
          roomCode: room.code,
          status: room.status,
          humanProgress: room.humanProgress,
          alienProgress: room.alienProgress,
          earthCores: room.earthCores,
          alien: room.alien,
          collectedShukaCoreIds: Array.from(room.collectedShukaCoreIds),
          specialists: { ...room.specialists }
        };

        if (callback) callback(payload);
        socket.emit('GAME_STATE_SYNC', payload);
      });

      // 8. REQUEST_REMATCH (Return room to LOBBY for a new match)
      socket.on('REQUEST_REMATCH', (_data: unknown, callback?: (res: any) => void) => {
        try {
          const roomCode = this.playerRoomMap.get(socket.id);
          if (!roomCode) {
            if (callback) callback({ success: false, error: 'ROOM NOT FOUND' });
            return;
          }

          const room = this.rooms.get(roomCode);
          if (!room) {
            if (callback) callback({ success: false, error: 'ROOM NOT FOUND' });
            return;
          }

          // Reset room state for rematch
          this.stopAuthoritativeAlienAI(room);
          room.status = 'LOBBY';
          room.humanProgress = 0;
          room.alienProgress = 0;
          room.collectedShukaCoreIds.clear();
          room.earthCores = INITIAL_EARTH_CORES.map((c) => ({ ...c, position: { ...c.position }, collected: false, extracting: false }));
          room.alien = {
            position: { x: 0, y: 1.5, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            state: 'IDLE',
            targetCoreId: null,
            extractionProgress: 0,
            collectedCores: 0
          };
          room.specialists.isLocked = false;
          room.players.forEach((p) => {
            p.ready = p.isHost;
          });

          console.log(`[RoomManager] Room ${roomCode} reset to LOBBY for REMATCH`);

          const sanitizedRoom = this.serializeRoom(room);
          this.io.to(roomCode).emit('REMATCH_STARTED', { room: sanitizedRoom });
          this.io.to(roomCode).emit('ROOM_UPDATED', { room: sanitizedRoom });

          if (callback) callback({ success: true, room: sanitizedRoom });
        } catch (err: any) {
          console.error('[RoomManager] Error processing REQUEST_REMATCH:', err);
          if (callback) callback({ success: false, error: err?.message || 'Rematch failed' });
        }
      });

      // 9. LEAVE_ROOM
      socket.on('LEAVE_ROOM', (_data: unknown, callback?: (res: any) => void) => {
        this.handleLeave(socket);
        if (callback) callback({ success: true });
      });

      // 7. DISCONNECT
      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        this.handleLeave(socket);
      });
    });
  }

  /**
   * Handles player leaving a room (manual or disconnect)
   */
  private handleLeave(socket: Socket): void {
    const roomCode = this.playerRoomMap.get(socket.id);
    if (!roomCode) return;

    this.playerRoomMap.delete(socket.id);
    socket.leave(roomCode);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const leavingPlayerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (leavingPlayerIndex === -1) return;

    const leavingPlayer = room.players[leavingPlayerIndex];
    room.players.splice(leavingPlayerIndex, 1);
    room.playerCooldowns.delete(socket.id);

    console.log(
      `[RoomManager] ${leavingPlayer.name} (${socket.id}) left room ${roomCode}. Remaining: ${room.players.length}`
    );

    // If room is empty, clear timer and delete room
    if (room.players.length === 0) {
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
      }
      this.stopAuthoritativeAlienAI(room);
      this.rooms.delete(roomCode);
      console.log(`[RoomManager] Room ${roomCode} deleted (empty)`);
      return;
    }

    // If leaving player was host, transfer host to next connected player
    if (leavingPlayer.isHost) {
      const newHost = room.players[0];
      newHost.isHost = true;
      newHost.ready = true; // Host ready
      room.hostId = newHost.id;

      console.log(`[RoomManager] Host transferred to ${newHost.name} (${newHost.id}) in room ${roomCode}`);

      this.io.to(roomCode).emit('HOST_CHANGED', {
        newHostId: newHost.id,
        newHostName: newHost.name
      });
    }

    // If game was starting and player count fell below minimum, cancel countdown
    if (room.status === 'STARTING' && room.players.length < RoomManager.MIN_PLAYERS_TO_START) {
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
      }
      room.status = 'LOBBY';
      this.io.to(roomCode).emit('COUNTDOWN_CANCELLED', {
        reason: 'Player left during countdown. Minimum 2 players required.'
      });
    }

    const sanitizedRoom = this.serializeRoom(room);
    this.io.to(roomCode).emit('PLAYER_LEFT', {
      playerId: socket.id,
      playerName: leavingPlayer.name,
      room: sanitizedRoom
    });

    if (room.status === 'PLAYING') {
      this.io.to(roomCode).emit('PLAYER_LEFT_GAME', {
        id: socket.id,
        playerName: leavingPlayer.name
      });
    }

    this.io.to(roomCode).emit('ROOM_UPDATED', { room: sanitizedRoom });
  }

  /**
   * Starts the server-authoritative Alien AI simulation for an active playing room.
   */
  public startAuthoritativeAlienAI(room: Room): void {
    this.stopAuthoritativeAlienAI(room);

    // Reset AI state & Earth cores
    room.alienProgress = 0;
    room.humanProgress = 0;
    room.collectedShukaCoreIds.clear();
    room.earthCores = INITIAL_EARTH_CORES.map((c) => ({
      ...c,
      position: { ...c.position },
      collected: false,
      extracting: false
    }));
    room.alien = {
      position: { x: 0, y: 1.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      state: 'SEARCHING',
      targetCoreId: null,
      extractionProgress: 0,
      collectedCores: 0
    };

    const dt = ALIEN_CONFIG.updateIntervalMs / 1000;

    console.log(`[RoomManager] Authoritative Alien AI started for room ${room.code}`);

    room.aiUpdateTimer = setInterval(() => {
      try {
        if (room.status !== 'PLAYING') {
          this.stopAuthoritativeAlienAI(room);
          return;
        }

        const alien = room.alien;

        switch (alien.state) {
          case 'IDLE': {
            // Check if any uncollected cores exist
            const hasUncollected = room.earthCores.some((c) => !c.collected);
            if (hasUncollected) {
              alien.state = 'SEARCHING';
            }
            break;
          }

          case 'SEARCHING': {
            // Find nearest uncollected Earth Core
            let closestCore: EarthCoreData | null = null;
            let minDistance = Infinity;

            for (const core of room.earthCores) {
              if (!core.collected) {
                const dx = core.position.x - alien.position.x;
                const dz = core.position.z - alien.position.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < minDistance) {
                  minDistance = d;
                  closestCore = core;
                }
              }
            }

            if (closestCore) {
              alien.targetCoreId = closestCore.id;
              alien.state = 'MOVING';
              alien.extractionProgress = 0;
            } else {
              alien.state = 'IDLE';
              alien.targetCoreId = null;
            }
            break;
          }

          case 'MOVING': {
            const targetCore = room.earthCores.find((c) => c.id === alien.targetCoreId);
            if (!targetCore || targetCore.collected) {
              alien.state = 'SEARCHING';
              alien.targetCoreId = null;
              break;
            }

            const dx = targetCore.position.x - alien.position.x;
            const dz = targetCore.position.z - alien.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= ALIEN_CONFIG.arrivalDistance) {
              alien.state = 'EXTRACTING';
              alien.extractionProgress = 0;
              targetCore.extracting = true;
            } else {
              const nx = dx / dist;
              const nz = dz / dist;
              const step = Math.min(dist, ALIEN_CONFIG.speed * dt);
              alien.position.x += nx * step;
              alien.position.z += nz * step;
              alien.rotation.y = Math.atan2(dx, dz);
            }
            break;
          }

          case 'EXTRACTING': {
            const targetCore = room.earthCores.find((c) => c.id === alien.targetCoreId);
            if (!targetCore || targetCore.collected) {
              alien.state = 'SEARCHING';
              alien.targetCoreId = null;
              break;
            }

            targetCore.extracting = true;

            const now = Date.now();
            const isEmpPaused = !!(alien.empDisabledUntil && alien.empDisabledUntil > now);
            const isOverchargePaused = !!(alien.overchargeDisruptedUntil && alien.overchargeDisruptedUntil > now);

            // Clean up expired EMP/Overcharge states
            if (alien.empDisabledUntil && alien.empDisabledUntil <= now) {
              alien.empDisabledUntil = undefined;
              this.io.to(room.code).emit('EMP_STATE_UPDATED', { active: false });
            }
            if (alien.overchargeDisruptedUntil && alien.overchargeDisruptedUntil <= now) {
              alien.overchargeDisruptedUntil = undefined;
              this.io.to(room.code).emit('OVERCHARGE_STATE_UPDATED', { active: false });
            }

            // Only advance extraction progress if NOT paused by EMP and NOT disrupted by Overcharge
            if (!isEmpPaused && !isOverchargePaused) {
              alien.extractionProgress = Math.min(1.0, alien.extractionProgress + dt / ALIEN_CONFIG.extractionDuration);

              if (alien.extractionProgress >= 1.0) {
                targetCore.collected = true;
                targetCore.extracting = false;
                room.alienProgress = Math.min(5, room.alienProgress + 1);
                alien.collectedCores = room.alienProgress;
                alien.state = 'CORE_COLLECTED';

                console.log(
                  `[RoomManager] Room ${room.code}: Alien AI secured Earth Core '${targetCore.name}' (${room.alienProgress}/5)`
                );

                this.io.to(room.code).emit('EARTH_CORE_COLLECTED', {
                  coreId: targetCore.id,
                  coreName: targetCore.name,
                  collectedCores: room.alienProgress,
                  totalCores: 5
                });

                // Check Win condition (Alien reaches 5 cores)
                if (room.alienProgress >= 5) {
                  room.status = 'FINISHED';
                  this.stopAuthoritativeAlienAI(room);
                  this.io.to(room.code).emit('MATCH_FINISHED', {
                    winner: 'ALIEN',
                    humanProgress: room.humanProgress,
                    alienProgress: room.alienProgress,
                    reason: 'Alien AI secured all 5 Earth Energy Cores'
                  });
                  return;
                }
              }
            }
            break;
          }

          case 'CORE_COLLECTED': {
            alien.extractionProgress = 0;
            alien.targetCoreId = null;
            alien.state = 'SEARCHING';
            break;
          }
        }

        const now = Date.now();
        const empActive = !!(alien.empDisabledUntil && alien.empDisabledUntil > now);
        const overchargeActive = !!(alien.overchargeDisruptedUntil && alien.overchargeDisruptedUntil > now);

        // Broadcast compact state update to room clients
        this.io.to(room.code).emit('ALIEN_UPDATED', {
          position: alien.position,
          rotation: alien.rotation,
          state: alien.state,
          targetCoreId: alien.targetCoreId,
          collectedCores: room.alienProgress,
          extractionProgress: alien.extractionProgress,
          empActive,
          empRemaining: empActive ? Math.max(0, (alien.empDisabledUntil! - now) / 1000) : 0,
          overchargeActive,
          overchargeRemaining: overchargeActive ? Math.max(0, (alien.overchargeDisruptedUntil! - now) / 1000) : 0
        });
      } catch (err) {
        console.error(`[RoomManager] Error in Alien AI update loop for room ${room.code}:`, err);
      }
    }, ALIEN_CONFIG.updateIntervalMs);
  }

  /**
   * Cleans up the Alien AI interval for a room
   */
  public stopAuthoritativeAlienAI(room: Room): void {
    if (room.aiUpdateTimer) {
      clearInterval(room.aiUpdateTimer);
      room.aiUpdateTimer = null;
    }
  }

  /**
   * Strips non-serializable objects (like timers) from room payload
   */
  private serializeRoom(room: Room): any {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      players: room.players.map((p) => ({ ...p })),
      countdownValue: room.countdownValue,
      humanProgress: room.humanProgress,
      alienProgress: room.alienProgress,
      earthCores: room.earthCores.map((c) => ({ ...c })),
      alien: {
        position: { ...room.alien.position },
        rotation: { ...room.alien.rotation },
        state: room.alien.state,
        targetCoreId: room.alien.targetCoreId,
        extractionProgress: room.alien.extractionProgress,
        collectedCores: room.alien.collectedCores
      },
      specialists: room.specialists ? { ...room.specialists } : undefined
    };
  }

  // Diagnostic helpers
  public getRoom(code: string): Room | undefined {
    return this.rooms.get(this.normalizeCode(code));
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }
}
