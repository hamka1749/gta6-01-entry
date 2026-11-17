// SUNSET KEYS — the player on foot.
// WASD moves relative to the camera, Shift runs, and the body turns toward
// the direction of travel. Buildings stop the player: each axis is tested
// separately, so the player slides along walls instead of sticking to them.

import { COMBAT_COOLDOWN, COMBAT_SWING_SECONDS, PLAYER_RADIUS, RUN_SPEED, SPAWN, WALK_SPEED } from './config.js';
import { isBlocked } from './city.js';
import { buildCharacter } from './character.js';

export function createPlayer(scene) {
  const parts = buildCharacter();
  scene.add(parts.group);

  const state = {
    x: SPAWN.x,
    z: SPAWN.z,
    heading: SPAWN.heading,
    speed: 0,
    moving: false,
    walkPhase: 0,
    // On-foot combat: the shove's arm swing and the wait until the next one.
    punchTimer: 0,
    punchCooldown: 0,
    mesh: parts.group,
  };

  function applyPose() {
    parts.group.position.set(state.x, 0, state.z);
    parts.group.rotation.y = state.heading;
    // Legs and arms swing with the walk cycle; still when standing.
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.6 : 0;
    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
    parts.leftArm.rotation.x = -swing * 0.7;
    // A shove overrides the right arm: it swings forward and back over the
    // swing's length, whatever the legs are doing.
    if (state.punchTimer > 0) {
      const phase = state.punchTimer / COMBAT_SWING_SECONDS;
      parts.rightArm.rotation.x = -1.9 * Math.sin(phase * Math.PI);
    } else {
      parts.rightArm.rotation.x = swing * 0.7;
    }
  }

  return {
    state,
    /** Step the player for `dt` seconds. `move` is input, `cameraYaw` is where the camera looks. */
    step(dt, move, cameraYaw, colliders) {
      if (state.punchTimer > 0) state.punchTimer = Math.max(0, state.punchTimer - dt);
      if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);
      const speed = move.run ? RUN_SPEED : WALK_SPEED;
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      let dx = forwardX * move.forward + rightX * move.strafe;
      let dz = forwardZ * move.forward + rightZ * move.strafe;
      const length = Math.hypot(dx, dz);
      state.moving = length > 0;
      if (state.moving) {
        dx /= length;
        dz /= length;
        const stepX = dx * speed * dt;
        const stepZ = dz * speed * dt;
        // Move one axis at a time so a wall blocks only the blocked axis.
        if (!isBlocked(colliders, state.x + stepX, state.z, PLAYER_RADIUS)) state.x += stepX;
        if (!isBlocked(colliders, state.x, state.z + stepZ, PLAYER_RADIUS)) state.z += stepZ;
        state.heading = Math.atan2(dx, dz);
        state.walkPhase += dt * speed * 1.6;
        state.speed = speed;
      } else {
        state.speed = 0;
      }
      applyPose();
    },
    teleport(x, z, heading) {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.walkPhase = 0;
      applyPose();
    },
    reset() {
      this.teleport(SPAWN.x, SPAWN.z, SPAWN.heading);
      this.lowerArms();
      // A reset mid-stride leaves no stale speed behind for the chase
      // systems to read before the next step runs.
      state.speed = 0;
      state.moving = false;
      state.punchTimer = 0;
      state.punchCooldown = 0;
    },
    /**
     * Start a shove: the arm swings and the cooldown starts. Returns false
     * while the cooldown is still running, so a second shove inside it
     * does nothing — the timer is left untouched.
     */
    punch() {
      if (state.punchCooldown > 0) return false;
      state.punchTimer = COMBAT_SWING_SECONDS;
      state.punchCooldown = COMBAT_COOLDOWN;
      applyPose();
      return true;
    },
    show() {
      parts.group.visible = true;
    },
    hide() {
      parts.group.visible = false;
    },
    /** Hands up: the busted pose, held until the run resets. */
    raiseArms() {
      parts.leftArm.rotation.x = -2.4;
      parts.rightArm.rotation.x = -2.4;
    },
    /** Back to the normal swing (also called by reset). */
    lowerArms() {
      parts.leftArm.rotation.x = 0;
      parts.rightArm.rotation.x = 0;
    },
  };
}
