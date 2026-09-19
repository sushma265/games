/**
 * InputManager - Centralized abstraction for Desktop & Mobile controls.
 * Guarantees identical gameplay functionality regardless of platform.
 */
export class InputManager {
  // Movement keys
  private keys: Record<string, boolean> = {};
  
  // Mobile virtual joystick vector (-1 to 1)
  private virtualJoystickVector = { x: 0, z: 0 };
  
  // Mouse & Touch camera rotation deltas
  private cameraDelta = { dx: 0, dy: 0 };
  private isPointerLocked: boolean = false;
  private isMouseDown: boolean = false;
  private lastMousePos = { x: 0, y: 0 };

  // Actions
  private mobileExtracting: boolean = false;
  private resetTriggered: boolean = false;
  private pauseTriggered: boolean = false;
  private abilityTriggers: Record<number, boolean> = { 1: false, 2: false, 3: false };

  // Look sensitivity
  public mouseSensitivity: number = 0.0024;
  public touchSensitivity: number = 0.0035;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initKeyboardListeners();
    this.initMouseListeners();
  }

  private initKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      // Prevent ability or movement activation while typing in text inputs (menus, chat, lobby)
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      this.keys[e.code] = true;
      this.keys[e.key] = true;
      if (e.key) {
        this.keys[e.key.toLowerCase()] = true;
      }

      // Reset action for manual testing (Shift + R or T to avoid conflict with R = Scan)
      if ((e.code === 'KeyR' && e.shiftKey) || e.code === 'KeyT') {
        this.resetTriggered = true;
      }

      // Pause action (P)
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        this.pauseTriggered = true;
      }

      // Phase 11 Abilities (E -> EMP Surge, Q -> Overcharge, R -> Scan)
      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E' || e.code === 'Digit1' || e.key === '1') {
        this.abilityTriggers[1] = true;
      }
      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q' || e.code === 'Digit2' || e.key === '2') {
        this.abilityTriggers[2] = true;
      }
      if ((e.code === 'KeyR' || e.key === 'r' || e.key === 'R') && !e.shiftKey || e.code === 'Digit3' || e.key === '3') {
        this.abilityTriggers[3] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      this.keys[e.code] = false;
      this.keys[e.key] = false;
      if (e.key) {
        this.keys[e.key.toLowerCase()] = false;
      }
    });
  }

  private initMouseListeners(): void {
    // Pointer lock for immersive desktop controls
    this.canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== this.canvas && !this.isMobileDevice()) {
        try {
          this.canvas.requestPointerLock();
        } catch {
          // pointer lock denied or not supported in current context
        }
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.cameraDelta.dx += e.movementX * this.mouseSensitivity;
        this.cameraDelta.dy += e.movementY * this.mouseSensitivity;
      } else if (this.isMouseDown) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.cameraDelta.dx += dx * this.mouseSensitivity * 1.5;
        this.cameraDelta.dy += dy * this.mouseSensitivity * 1.5;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
  }

  public isMobileDevice(): boolean {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 850;
  }

  // Mobile virtual joystick hook
  public setVirtualJoystick(x: number, z: number): void {
    this.virtualJoystickVector = { x, z };
  }

  // Mobile camera touch swipe hook
  public addTouchCameraDelta(dx: number, dy: number): void {
    this.cameraDelta.dx += dx * this.touchSensitivity;
    this.cameraDelta.dy += dy * this.touchSensitivity;
  }

  // Mobile extract button hook
  public setMobileExtract(extracting: boolean): void {
    this.mobileExtracting = extracting;
  }

  // Mobile ability trigger hook
  public triggerAbility(id: 1 | 2 | 3): void {
    this.abilityTriggers[id] = true;
  }

  /**
   * Returns normalized local movement vector: { x: horizontal, z: forward }
   */
  public getMoveVector(): { x: number; z: number } {
    let x = 0;
    let z = 0;

    // Desktop keyboard
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    // Blend with virtual joystick
    x += this.virtualJoystickVector.x;
    z += this.virtualJoystickVector.z;

    // Normalize if magnitude > 1
    const len = Math.sqrt(x * x + z * z);
    if (len > 1) {
      x /= len;
      z /= len;
    }

    return { x, z };
  }

  public isSprinting(): boolean {
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }

  /**
   * Returns whether the extraction input action is currently held.
   * Desktop control: F or Space = HOLD TO EXTRACT (avoids conflict with E = EMP Surge).
   * Compatible with touch button extraction binding.
   */
  public isExtracting(): boolean {
    return !!(
      this.keys['KeyF'] ||
      this.keys['f'] ||
      this.keys['F'] ||
      this.keys['Space'] ||
      this.mobileExtracting
    );
  }

  public isExtractHeld(): boolean {
    return this.isExtracting();
  }

  public consumeReset(): boolean {
    if (this.resetTriggered) {
      this.resetTriggered = false;
      return true;
    }
    return false;
  }

  public consumePause(): boolean {
    if (this.pauseTriggered) {
      this.pauseTriggered = false;
      return true;
    }
    return false;
  }

  public consumeAbility(id: 1 | 2 | 3): boolean {
    if (this.abilityTriggers[id]) {
      this.abilityTriggers[id] = false;
      return true;
    }
    return false;
  }

  /**
   * Consumes and resets camera rotational deltas for current frame
   */
  public consumeCameraDelta(): { dx: number; dy: number } {
    const delta = { ...this.cameraDelta };
    this.cameraDelta.dx = 0;
    this.cameraDelta.dy = 0;
    return delta;
  }
}
