// SUNSET KEYS — cars: parked, in traffic, and driven by the player.
// A car is boxes and cylinders in the island's colours: body, cabin, four
// wheels, headlights and taillights. Parked cars line the roadsides; traffic
// cars cruise rectangular loops around the blocks; the driven car uses simple
// arcade physics — accelerate, brake, reverse and steer — and stops at walls.

import * as THREE from 'three';
import {
  CAR_ACCEL, CAR_BRAKE, CAR_COLORS, CAR_REVERSE_SPEED, CAR_TOP_SPEED, CAR_TURN_RATE,
  ENTER_CAR_RANGE, ROAD_HALF, ROAD_SPACING,
} from './config.js';
import { ROAD_LINES } from './city.js';
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
