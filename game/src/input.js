// SUNSET KEYS — keyboard and mouse input.
// Held keys give a movement direction; one-shot presses (enter a car, reset)
// are queued and taken once by the loop, so a press between two frames is
// never lost and never counted twice. Dragging the mouse orbits the camera.

export const ACTION_ENTER = 1;
export const ACTION_RESET = 2;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const ENTER = new Set(['KeyE']);
const RESET = new Set(['KeyR']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragX = 0;
  let dragY = 0;
  let wheel = 0;

  window.addEventListener('keydown', (event) => {
    if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (RESET.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESET;
    } else if (
      FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) ||
      RIGHT.has(event.code) || RUN.has(event.code) || BRAKE.has(event.code)
    ) {
      held.add(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('wheel', (event) => {
    wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  const has = (set) => {
    for (const code of set) if (held.has(code)) return true;
    return false;
  };

  return {
    /** -1..1 forward/back and left/right from the held keys. */
    move() {
      return {
        forward: (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0),
        strafe: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        run: has(RUN),
        brake: has(BRAKE),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Mouse drag since the last call, in pixels; wheel zoom the same way. */
    takeDrag() {
      const taken = { x: dragX, y: dragY, wheel };
      dragX = 0;
      dragY = 0;
      wheel = 0;
      return taken;
    },
  };
}
