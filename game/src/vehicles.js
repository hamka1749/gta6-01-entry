// SUNSET KEYS — cars: parked, in traffic, and driven by the player.
// A car is boxes and cylinders in the island's colours: body, cabin, four
// wheels, headlights and taillights. Parked cars line the roadsides; traffic
// cars cruise rectangular loops around the blocks; the driven car uses simple
// arcade physics — accelerate, brake, reverse and steer — and stops at walls.

import * as THREE from 'three';
import {
  BUSTED_DISTANCE, CAR_ACCEL, CAR_BRAKE, CAR_COLORS, CAR_REVERSE_SPEED, CAR_TOP_SPEED,
  CAR_TURN_RATE, ENTER_CAR_RANGE, POLICE_ACCEL, POLICE_STUCK_HOLD, POLICE_STUCK_SECONDS,
  POLICE_TOP_SPEED, POLICE_TURN_RATE, ROAD_HALF, ROAD_SPACING,
} from './config.js';
import { ROAD_LINES, roadPointBehind } from './city.js';
import { isBlocked } from './city.js';
import { pick, range } from './rng.js';

/** Build one car mesh. Returns the group plus its spinning/steering wheels. */
export function buildCarMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2b36, roughness: 0.15, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.2), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.0), paint);
  roof.position.set(0, 1.4, -0.25);
  group.add(roof);

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  for (const side of [-0.62, 0.62]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    head.position.set(side, 0.62, 2.12);
    group.add(head);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd21f1f, emissive: 0xa01010, emissiveIntensity: 0.7 });
  for (const side of [-0.62, 0.62]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tail.position.set(side, 0.62, -2.12);
    group.add(tail);
  }

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz, front] of [[-0.95, 1.35, true], [0.95, 1.35, true], [-0.95, -1.35, false], [0.95, -1.35, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tyreMesh = new THREE.Mesh(wheelGeo, tyre);
    tyreMesh.castShadow = true;
    const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), hub);
    hubMesh.rotation.z = Math.PI / 2;
    pivot.add(tyreMesh, hubMesh);
    group.add(pivot);
    wheels.push({ pivot, tyre: tyreMesh, front });
  }

  return { group, wheels };
}

function placeOnGround(mesh, x, z, heading) {
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
}

/**
 * Parked cars along the roadsides and the traffic cars that cruise the
 * blocks. Returns the list of cars; each car is { mesh, wheels, x, z,
 * heading, speed, driven, traffic, loop, loopDistance }.
 */
export function createTraffic(scene, rng) {
  const cars = [];

  // Parked cars: one or two per roadside stretch, hugging the kerb.
  for (const line of ROAD_LINES) {
    for (const along of [-100, -60, -20, 20, 60, 100]) {
      if (rng() < 0.45) continue;
      const side = rng() < 0.5 ? 1 : -1;
      const mesh = buildCarMesh(pick(rng, CAR_COLORS));
      const heading = rng() < 0.5 ? 0 : Math.PI;
      const vertical = rng() < 0.5;
      const x = vertical ? line + side * (ROAD_HALF - 1.4) : along;
      const z = vertical ? along : line + side * (ROAD_HALF - 1.4);
      placeOnGround(mesh.group, x, z, vertical ? heading : heading + Math.PI / 2);
      scene.add(mesh.group);
      cars.push({
        mesh: mesh.group, wheels: mesh.wheels, x, z,
        heading: vertical ? heading : heading + Math.PI / 2,
        speed: 0, driven: false, traffic: false, loop: null, loopDistance: 0,
      });
    }
  }

  // Traffic cars: each cruises a rectangular loop around one block.
  for (let i = 0; i < 6; i += 1) {
    const bx = ROAD_LINES[1 + Math.floor(rng() * 5)];
    const bz = ROAD_LINES[1 + Math.floor(rng() * 5)];
    const loop = [
      { x: bx - ROAD_SPACING, z: bz - ROAD_SPACING },
      { x: bx + ROAD_SPACING, z: bz - ROAD_SPACING },
      { x: bx + ROAD_SPACING, z: bz + ROAD_SPACING },
      { x: bx - ROAD_SPACING, z: bz + ROAD_SPACING },
    ];
    const mesh = buildCarMesh(pick(rng, CAR_COLORS));
    scene.add(mesh.group);
    cars.push({
      mesh: mesh.group, wheels: mesh.wheels, x: loop[0].x, z: loop[0].z,
      heading: 0, speed: range(rng, 6, 9), driven: false, traffic: true,
      loop, loopDistance: range(rng, 0, 160),
    });
  }

  return cars;
}

/** Move one traffic car along its rectangular loop for `dt` seconds. */
function stepTrafficCar(car, dt) {
  const perimeter = 4 * ROAD_SPACING * 2;
  car.loopDistance = (car.loopDistance + car.speed * dt) % perimeter;
  let remaining = car.loopDistance;
  for (let i = 0; i < 4; i += 1) {
    const a = car.loop[i];
    const b = car.loop[(i + 1) % 4];
    const segment = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining <= segment) {
      const t = remaining / segment;
      car.x = a.x + (b.x - a.x) * t;
      car.z = a.z + (b.z - a.z) * t;
      const targetHeading = Math.atan2(b.x - a.x, b.z - a.z);
      // Ease the heading around corners instead of snapping.
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += diff * Math.min(1, dt * 6);
      break;
    }
    remaining -= segment;
  }
  placeOnGround(car.mesh, car.x, car.z, car.heading);
  spinWheels(car, dt);
}

function spinWheels(car, dt) {
  const roll = (car.speed * dt) / 0.36;
  for (const wheel of car.wheels) {
    wheel.tyre.rotation.x += roll;
    if (wheel.front) wheel.pivot.rotation.y = car.steer ?? 0;
  }
}

/**
 * The driven car: arcade physics. `move` is input; the car accelerates
 * forward, brakes, reverses, and steers more at low speed, less at high
 * speed. Walls stop it: the next position is tested before it is taken.
 */
export function stepDrivenCar(car, dt, move, colliders) {
  if (move.forward > 0) car.speed += CAR_ACCEL * dt;
  else if (move.forward < 0) {
    car.speed = car.speed > 0.5 ? car.speed - CAR_BRAKE * dt : car.speed - CAR_ACCEL * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  }
  if (move.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR_BRAKE * dt);
  car.speed = Math.max(-CAR_REVERSE_SPEED, Math.min(CAR_TOP_SPEED, car.speed));

  const steerInput = move.strafe;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 8);
  car.steer = steerInput * 0.45 * speedFactor;
  car.heading += steerInput * CAR_TURN_RATE * speedFactor * dt * Math.sign(car.speed || 1);

  const nextX = car.x + Math.sin(car.heading) * car.speed * dt;
  const nextZ = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!isBlocked(colliders, nextX, nextZ, 1.6)) {
    car.x = nextX;
    car.z = nextZ;
  } else {
    car.speed *= 0.4;
  }
  placeOnGround(car.mesh, car.x, car.z, car.heading);
  spinWheels(car, dt);
}

/** Step every traffic car; the driven car is stepped by the game loop. */
export function stepTraffic(cars, dt) {
  for (const car of cars) {
    if (car.traffic) stepTrafficCar(car, dt);
  }
}

/** The nearest car within ENTER_CAR_RANGE of (x, z), or null. */
export function nearestCar(cars, x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (const car of cars) {
    const distance = Math.hypot(car.x - x, car.z - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = car;
    }
  }
  return bestDistance <= ENTER_CAR_RANGE ? best : null;
}

/**
 * A police cruiser: a dark car with a white roof and a light bar whose red
 * and blue lenses flash on a fixed simulation phase (never the wall clock,
 * so the chase screenshot stages the same frame every time).
 */
export function buildPoliceMesh() {
  const base = buildCarMesh(0x22242a);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.1, 2.0), roofMat);
  roof.position.set(0, 1.42, -0.25);
  base.group.add(roof);

  const barMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.5 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.3), barMat);
  bar.position.set(0, 1.52, -0.25);
  base.group.add(bar);

  const lightRedMat = new THREE.MeshStandardMaterial({
    color: 0xd21f1f, emissive: 0xff2020, emissiveIntensity: 2.2,
  });
  const lightRed = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.32), lightRedMat);
  lightRed.position.set(-0.28, 1.53, -0.25);
  base.group.add(lightRed);

  const lightBlueMat = new THREE.MeshStandardMaterial({
    color: 0x2050d2, emissive: 0x2050ff, emissiveIntensity: 0.15,
  });
  const lightBlue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.32), lightBlueMat);
  lightBlue.position.set(0.28, 1.53, -0.25);
  base.group.add(lightBlue);

  return { ...base, lightRed, lightBlue };
}

/** Spawn one police cruiser at (x, z), facing `heading`. */
export function createPolice(scene, x, z, heading) {
  const mesh = buildPoliceMesh();
  placeOnGround(mesh.group, x, z, heading);
  scene.add(mesh.group);
  return {
    mesh: mesh.group, wheels: mesh.wheels, lightRed: mesh.lightRed, lightBlue: mesh.lightBlue,
    x, z, heading, speed: 0, driven: false, traffic: false, loop: null, loopDistance: 0,
    police: true, lightPhase: 0, stuckTimer: 0, stuckHold: 0, ramCooldown: 0,
    lastX: x, lastZ: z, stillTimer: 0,
  };
}

/** Remove every police cruiser from the scene (wanted cleared, mission done). */
export function removePolice(scene, police) {
  for (const car of police) scene.remove(car.mesh);
  police.length = 0;
}

/**
 * How fast a cruiser wants to go at `distance` from a target moving at
 * `targetSpeed`: flat out while far away, then the target's speed plus a
 * closing term once close. Near a stopped target it creeps to a 2 m hover
 * (close enough to hold for a bust); near a moving one it holds a 4 m
 * bumper gap — a cruiser that only slows down near a fast car falls off
 * the bumper, and one that closes to 2 m drives straight through it
 * (cars are 4.2 m long).
 */
function policeDesiredSpeed(distance, targetSpeed) {
  if (distance >= 8) return POLICE_TOP_SPEED;
  const hover = targetSpeed < 1 ? 2.0 : 4.0;
  return Math.min(POLICE_TOP_SPEED, targetSpeed + Math.max(0, distance - hover) * 1.5);
}

/**
 * Turn `car` toward the point (dx, dz) away, at the police turn rate.
 * Returns the signed heading error, for the caller to use (a cruiser
 * scraping a wall keeps turning the same way it already was).
 */
function policeSteer(car, dx, dz, dt) {
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-1, Math.min(1, diff * 2));
  const speedFactor = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += turn * POLICE_TURN_RATE * speedFactor * dt;
  return diff;
}

/**
 * One police cruiser chasing `target` ({x, z, speed}) for `dt` seconds.
 * It steers straight at the target and closes in fast from afar, then
 * eases off near a slow target and parks beside it — a cruiser that only
 * drives through would never hold the player for a bust. A cruiser wedged
 * on a building for POLICE_STUCK_SECONDS sits still for POLICE_STUCK_HOLD,
 * then turns away, which is how a good driver shakes one off. Returns the
 * distance to the target.
 */
export function stepPolice(car, target, dt, colliders) {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const distance = Math.hypot(dx, dz);

  // Flash the light bar: red and blue alternate every 0.35 s of sim time.
  car.lightPhase = (car.lightPhase + dt) % 0.7;
  const redOn = car.lightPhase < 0.35;
  car.lightRed.material.emissiveIntensity = redOn ? 2.2 : 0.15;
  car.lightBlue.material.emissiveIntensity = redOn ? 0.15 : 2.2;
  if (car.ramCooldown > 0) car.ramCooldown -= dt;

  // Wedged: sit still for the hold, then turn away from the wall.
  if (car.stuckHold > 0) {
    car.stuckHold -= dt;
    car.speed = 0;
    if (car.stuckHold <= 0) car.heading += 1.0;
    spinWheels(car, dt);
    return distance;
  }

  const targetSpeed = target.speed ?? 0;
  const desiredSpeed = policeDesiredSpeed(distance, targetSpeed);
  if (distance < BUSTED_DISTANCE && targetSpeed < 1) {
    car.speed = Math.max(0, car.speed - POLICE_ACCEL * 2 * dt);
  } else if (car.speed < desiredSpeed) {
    car.speed = Math.min(desiredSpeed, car.speed + POLICE_ACCEL * dt);
  } else {
    car.speed = Math.max(desiredSpeed, car.speed - POLICE_ACCEL * dt);
  }

  const diff = policeSteer(car, dx, dz, dt);

  const nextX = car.x + Math.sin(car.heading) * car.speed * dt;
  const nextZ = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!isBlocked(colliders, nextX, nextZ, 1.6)) {
    car.x = nextX;
    car.z = nextZ;
  } else {
    // Scraping a wall: lose speed, keep turning toward the target.
    car.speed *= 0.5;
    car.heading += 0.6 * dt * (diff >= 0 ? 1 : -1);
  }
  placeOnGround(car.mesh, car.x, car.z, car.heading);
  spinWheels(car, dt);

  // Barely moved for two seconds while trying to drive: wedged.
  const moved = Math.hypot(car.x - car.lastX, car.z - car.lastZ);
  if (desiredSpeed > 1 && moved < 0.01 && car.speed < 0.5) {
    car.stillTimer += dt;
    if (car.stillTimer >= POLICE_STUCK_SECONDS) {
      car.stuckHold = POLICE_STUCK_HOLD;
      car.stillTimer = 0;
    }
  } else {
    car.stillTimer = 0;
  }
  car.lastX = car.x;
  car.lastZ = car.z;
  return distance;
}

/** A road point behind `target`, for a fresh cruiser to spawn on. */
export function policeSpawnPoint(target, distance) {
  return roadPointBehind(target.x, target.z, target.heading, distance);
}

/** The index of `car` in the traffic list, or -1 — how a save names the driven car. */
export function carIndex(cars, car) {
  for (let i = 0; i < cars.length; i += 1) {
    if (cars[i] === car) return i;
  }
  return -1;
}
