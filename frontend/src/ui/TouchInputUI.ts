import { InputManager } from '../core/InputManager';
import { AbilitySystem } from '../gameplay/AbilitySystem';

export class TouchInputUI {
  private container: HTMLElement;
  private inputMgr: InputManager;
  private abilitySys: AbilitySystem;

  private joystickBase!: HTMLElement;
  private joystickThumb!: HTMLElement;
  private cameraZone!: HTMLElement;
  private extractBtn!: HTMLElement;

  private touchIdJoystick: number | null = null;
  private touchIdCamera: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private lastCameraTouch = { x: 0, y: 0 };

  constructor(container: HTMLElement, inputMgr: InputManager, abilitySys: AbilitySystem) {
    this.container = container;
    this.inputMgr = inputMgr;
    this.abilitySys = abilitySys;

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <!-- Virtual Joystick Zone (Bottom Left) -->
      <div id="touch-joystick-base" class="virtual-joystick-base">
        <div id="touch-joystick-thumb" class="virtual-joystick-thumb"></div>
      </div>

      <!-- Touch Camera Swipe Zone (Right Screen Half) -->
      <div id="touch-camera-zone" class="touch-camera-zone"></div>

      <!-- Action Cluster (Bottom Right) -->
      <div class="mobile-action-cluster">
        <!-- Ability Row -->
        <div class="mobile-abilities-row">
          <button id="touch-btn-emp" class="mobile-ability-btn border-cyan-400 text-cyan-300">
            EMP
          </button>
          <button id="touch-btn-overcharge" class="mobile-ability-btn border-amber-400 text-amber-400">
            CHG
          </button>
          <button id="touch-btn-scan" class="mobile-ability-btn border-cyan-400 text-cyan-400">
            SCAN
          </button>
        </div>

        <!-- Big Extract Hold Button -->
        <button id="touch-btn-extract" class="mobile-extract-btn">
          <span class="text-[10px] tracking-wider text-white">HOLD TO</span>
          <span>EXTRACT</span>
        </button>
      </div>
    `;

    this.joystickBase = this.container.querySelector('#touch-joystick-base')!;
    this.joystickThumb = this.container.querySelector('#touch-joystick-thumb')!;
    this.cameraZone = this.container.querySelector('#touch-camera-zone')!;
    this.extractBtn = this.container.querySelector('#touch-btn-extract')!;
  }

  private setupListeners(): void {
    // 1. Virtual Joystick
    const onJoystickTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchIdJoystick === null) {
          this.touchIdJoystick = touch.identifier;
          const rect = this.joystickBase.getBoundingClientRect();
          this.joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
          this.updateJoystickPosition(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const onJoystickTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdJoystick) {
          this.updateJoystickPosition(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const onJoystickTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdJoystick) {
          this.touchIdJoystick = null;
          this.joystickThumb.style.transform = 'translate(0px, 0px)';
          this.inputMgr.setVirtualJoystick(0, 0);
          break;
        }
      }
    };

    this.joystickBase.addEventListener('touchstart', onJoystickTouchStart, { passive: false });
    window.addEventListener('touchmove', onJoystickTouchMove, { passive: false });
    window.addEventListener('touchend', onJoystickTouchEnd);
    window.addEventListener('touchcancel', onJoystickTouchEnd);

    // 2. Camera Touch Drag Zone
    this.cameraZone.addEventListener('touchstart', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchIdCamera === null) {
          this.touchIdCamera = touch.identifier;
          this.lastCameraTouch = { x: touch.clientX, y: touch.clientY };
          break;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdCamera) {
          const dx = touch.clientX - this.lastCameraTouch.x;
          const dy = touch.clientY - this.lastCameraTouch.y;
          this.lastCameraTouch = { x: touch.clientX, y: touch.clientY };
          this.inputMgr.addTouchCameraDelta(dx, dy);
          break;
        }
      }
    }, { passive: true });

    const onCameraTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchIdCamera) {
          this.touchIdCamera = null;
          break;
        }
      }
    };
    window.addEventListener('touchend', onCameraTouchEnd);
    window.addEventListener('touchcancel', onCameraTouchEnd);

    // 3. Extract Button Hold
    const startExtract = (e: Event) => {
      e.preventDefault();
      this.extractBtn.classList.add('extracting');
      this.inputMgr.setMobileExtract(true);
    };

    const stopExtract = () => {
      this.extractBtn.classList.remove('extracting');
      this.inputMgr.setMobileExtract(false);
    };

    this.extractBtn.addEventListener('touchstart', startExtract, { passive: false });
    this.extractBtn.addEventListener('touchend', stopExtract);
    this.extractBtn.addEventListener('touchcancel', stopExtract);
    this.extractBtn.addEventListener('mousedown', startExtract);
    this.extractBtn.addEventListener('mouseup', stopExtract);
    this.extractBtn.addEventListener('mouseleave', stopExtract);

    // 4. Ability Buttons
    this.container.querySelector('#touch-btn-emp')!.addEventListener('click', () => {
      this.abilitySys.activateAbility(1);
    });
    this.container.querySelector('#touch-btn-overcharge')!.addEventListener('click', () => {
      this.abilitySys.activateAbility(2);
    });
    this.container.querySelector('#touch-btn-scan')!.addEventListener('click', () => {
      this.abilitySys.activateAbility(3);
    });
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    const maxRadius = 45;
    let dx = clientX - this.joystickCenter.x;
    let dy = clientY - this.joystickCenter.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    this.joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;

    // Normalized vector (-1 to 1). Up is forward (z > 0), down is back (z < 0)
    const normX = dx / maxRadius;
    const normZ = -(dy / maxRadius);
    this.inputMgr.setVirtualJoystick(normX, normZ);
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.remove('hidden');
      document.body.classList.add('mobile-active');
    } else {
      this.container.classList.add('hidden');
      document.body.classList.remove('mobile-active');
    }
  }
}
