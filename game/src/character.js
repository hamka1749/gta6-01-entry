// SUNSET KEYS — the player character, a stylised islander built from boxes.
// A teal shirt, dark shorts, a straw hat and swinging legs: readable at a
// glance from the third-person camera, and cheap enough to animate by hand.
// Pedestrians share the same rig with different shirts (and sometimes no
// hat), so the island reads as lived-in without a second character system.

import * as THREE from 'three';
import {
  BLOCK_CENTRES, sidewalkLoop,
} from './city.js';
import {
  PEDESTRIAN_COUNT, PEDESTRIAN_FLEE_DISTANCE, PEDESTRIAN_FLEE_SECONDS,
  PEDESTRIAN_FLEE_SPEED, PEDESTRIAN_WALK_SPEED,
} from './config.js';
import { chance, pick } from './rng.js';

const PEDESTRIAN_SHIRTS = [0xe07840, 0x7a4fd0, 0xf2c230, 0x3aa655, 0xd23b2e, 0xe8e8e8];
const PEDESTRIAN_SHORTS = [0x2c313a, 0x5c6e7a, 0x7a4a3a, 0x3f6b52];

/** Build the character group. Its named parts are animated by player.js. */
export function buildCharacter(options = {}) {
  const shirtColor = options.shirt ?? 0x2e9e8f;
  const shortsColor = options.shorts ?? 0x2c313a;
  const withHat = options.hat ?? true;
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const shorts = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.85 });
  const hat = new THREE.MeshStandardMaterial({ color: 0xe8d27a, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);

  if (withHat) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), hat);
    brim.position.y = 1.94;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12), hat);
    crown.position.y = 2.02;
    group.add(crown);
  }

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), shorts);
  leftLeg.geometry.translate(0, -0.36, 0);
  leftLeg.position.set(-0.16, 0.78, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), shorts);
  rightLeg.geometry.translate(0, -0.36, 0);
  rightLeg.position.set(0.16, 0.78, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.4), shoe);
  leftShoe.position.set(0, -0.72, 0.05);
  leftLeg.add(leftShoe);
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.4), shoe);
  rightShoe.position.set(0, -0.72, 0.05);
  rightLeg.add(rightShoe);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), skin);
  leftArm.geometry.translate(0, -0.3, 0);
  leftArm.position.set(-0.42, 1.44, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), skin);
  rightArm.geometry.translate(0, -0.3, 0);
  rightArm.position.set(0.42, 1.44, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm };
}

/**
 * Pedestrians: islanders strolling the sidewalks. Each walks one block's
 * sidewalk loop; a car that comes close sends them running the other way.
 * Returns the list; each pedestrian is { group, parts, x, z, heading, loop,
 * corner, walkPhase, fleeTimer }.
 */
export function createPedestrians(scene, rng) {
  const pedestrians = [];
  for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) {
    const bx = pick(rng, BLOCK_CENTRES);
    const bz = pick(rng, BLOCK_CENTRES);
    const loop = sidewalkLoop(bx, bz);
    const corner = Math.floor(rng() * 4);
    const parts = buildCharacter({
      shirt: pick(rng, PEDESTRIAN_SHIRTS),
      shorts: pick(rng, PEDESTRIAN_SHORTS),
      hat: chance(rng, 0.5),
    });
    scene.add(parts.group);
    const start = loop[corner];
    parts.group.position.set(start.x, 0, start.z);
    pedestrians.push({
      group: parts.group,
      parts,
      x: start.x,
      z: start.z,
      heading: rng() * Math.PI * 2,
      loop,
      corner: (corner + 1) % 4,
      walkPhase: rng() * Math.PI * 2,
      fleeTimer: 0,
      fleeHeading: 0,
    });
  }
  return pedestrians;
}

/** Step every pedestrian for `dt` seconds. `cars` is every car on the road. */
export function stepPedestrians(pedestrians, cars, dt) {
  for (const ped of pedestrians) {
    // A car close by sends the pedestrian running away from it.
    let threat = null;
    let threatDistance = PEDESTRIAN_FLEE_DISTANCE;
    for (const car of cars) {
      const distance = Math.hypot(car.x - ped.x, car.z - ped.z);
      if (distance < threatDistance) {
        threatDistance = distance;
        threat = car;
      }
    }
    let speed = PEDESTRIAN_WALK_SPEED;
    let targetX;
    let targetZ;
    if (threat) {
      ped.fleeTimer = PEDESTRIAN_FLEE_SECONDS;
      ped.fleeHeading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      speed = PEDESTRIAN_FLEE_SPEED;
      targetX = ped.x + Math.sin(ped.fleeHeading) * 4;
      targetZ = ped.z + Math.cos(ped.fleeHeading) * 4;
    } else {
      const corner = ped.loop[ped.corner];
      targetX = corner.x;
      targetZ = corner.z;
      if (Math.hypot(targetX - ped.x, targetZ - ped.z) < 0.6) {
        ped.corner = (ped.corner + 1) % 4;
      }
    }
    const heading = Math.atan2(targetX - ped.x, targetZ - ped.z);
    let diff = heading - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += diff * Math.min(1, dt * 8);
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    ped.walkPhase += dt * speed * 1.6;
    ped.group.position.set(ped.x, 0, ped.z);
    ped.group.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.6;
    ped.parts.leftLeg.rotation.x = swing;
    ped.parts.rightLeg.rotation.x = -swing;
    ped.parts.leftArm.rotation.x = -swing * 0.7;
    ped.parts.rightArm.rotation.x = swing * 0.7;
  }
}
