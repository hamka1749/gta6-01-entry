// SUNSET KEYS — the player on foot.
// WASD moves relative to the camera, Shift runs, and the body turns toward
// the direction of travel. Buildings stop the player: each axis is tested
// separately, so the player slides along walls instead of sticking to them.

import { PLAYER_RADIUS, RUN_SPEED, SPAWN, WALK_SPEED } from './config.js';
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
    parts.rightArm.rotation.x = swing * 0.7;
  }

  return {
    state,
    /** Step the player for `dt` seconds. `move` is input, `cameraYaw` is where the camera looks. */
    step(dt, move, cameraYaw, colliders) {
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
    },
    show() {
      parts.group.visible = true;
    },
    hide() {
      parts.group.visible = false;
    },
  };
}
