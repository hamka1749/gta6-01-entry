// SUNSET KEYS — the third-person camera.
// It orbits the player (or the driven car) on a drag of the mouse, sits
// behind and above the target, and smooths its motion so turns feel gentle
// instead of snappy. The wheel zooms between the near and far limits.

import * as THREE from 'three';
import {
  CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE,
} from './config.js';

export function createCamera(renderer) {
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const state = {
    yaw: Math.PI * 0.75,
    pitch: 0.32,
    distance: CAMERA_DISTANCE,
    position: new THREE.Vector3(0, 10, 0),
  };

  function updateSize() {
    const width = renderer.domElement.clientWidth || window.innerWidth;
    const height = renderer.domElement.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  return {
    camera,
    state,
    resize: updateSize,
    /** Apply a mouse drag: orbit yaw and pitch, wheel zooms. */
    applyDrag(drag) {
      state.yaw -= drag.x * 0.005;
      state.pitch = Math.max(0.05, Math.min(1.1, state.pitch + drag.y * 0.004));
      state.distance = Math.max(
        CAMERA_MIN_DISTANCE,
        Math.min(CAMERA_MAX_DISTANCE, state.distance + drag.wheel * 0.005),
      );
    },
    /** Place the camera behind `target` (a {x, z} plus a height) and look at it. */
    follow(target, targetHeight, dt) {
      const distance = state.distance + (target.driving ? 2.5 : 0);
      const wanted = new THREE.Vector3(
        target.x + Math.sin(state.yaw) * Math.cos(state.pitch) * distance,
        targetHeight + Math.sin(state.pitch) * distance + 1.2,
        target.z + Math.cos(state.yaw) * Math.cos(state.pitch) * distance,
      );
      // Ease toward the wanted spot: instant on the first frame, smooth after.
      const blend = dt >= 1 ? 1 : 1 - Math.exp(-dt * 10);
      state.position.lerp(wanted, blend);
      camera.position.copy(state.position);
      camera.lookAt(target.x, targetHeight + 1.0, target.z);
    },
    /** Snap the camera to its wanted spot (used by screenshot poses). */
    snap(target, targetHeight) {
      this.follow(target, targetHeight, 1);
    },
  };
}
