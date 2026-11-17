// SUNSET KEYS — the city of Palmera Keys, built procedurally from a seed.
// A grid of roads, stucco buildings of varied heights and colours, sidewalks,
// palm trees and lamps, ringed by ocean, with the Marina pier on the south
// shore. The same seed always builds the same island. The module also owns
// collision: every building registers an axis-aligned footprint, and
// isBlocked() answers whether a circle at (x, z) would hit one.

import * as THREE from 'three';
import {
  BLOCK_SIZE, BUILDING_COLORS, CITY_HALF, CITY_SIZE, MARINA, ROAD_HALF,
  ROAD_SPACING, ROAD_WIDTH, ROOF_COLORS, SIDEWALK,
} from './config.js';
import { intRange, pick, range } from './rng.js';

// Road centre lines, in world units, from -120 to +120.
export const ROAD_LINES = [-120, -80, -40, 0, 40, 80, 120];
// Block centres sit between the roads.
export const BLOCK_CENTRES = [-100, -60, -20, 20, 60, 100];

/** A canvas texture painted with windows, shared by buildings of every colour. */
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#2c3e50';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      ctx.fillRect(10 + col * 30, 12 + row * 30, 18, 20);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The ground texture: one 1024x1024 canvas painted to the island's scale.
 * Sand at the shore, grass inside the blocks, asphalt roads with dashed
 * centre lines and crosswalks at every intersection.
 */
function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const toPx = (world) => ((world + CITY_HALF) / CITY_SIZE) * size;

  ctx.fillStyle = '#d9c49a'; // sand
  ctx.fillRect(0, 0, size, size);

  // Grass inside every block.
  ctx.fillStyle = '#69a85c';
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      ctx.fillRect(toPx(bx - BLOCK_SIZE / 2), toPx(bz - BLOCK_SIZE / 2), toPx(BLOCK_SIZE) - toPx(0), toPx(BLOCK_SIZE) - toPx(0));
    }
  }

  // Asphalt roads, both directions.
  ctx.fillStyle = '#3a3f46';
  for (const line of ROAD_LINES) {
    ctx.fillRect(0, toPx(line - ROAD_HALF), size, toPx(ROAD_WIDTH) - toPx(0));
    ctx.fillRect(toPx(line - ROAD_HALF), 0, toPx(ROAD_WIDTH) - toPx(0), size);
  }

  // Sidewalk borders around each block.
  ctx.strokeStyle = '#cfc8b8';
  ctx.lineWidth = 6;
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      ctx.strokeRect(
        toPx(bx - BLOCK_SIZE / 2), toPx(bz - BLOCK_SIZE / 2),
        toPx(BLOCK_SIZE) - toPx(0), toPx(BLOCK_SIZE) - toPx(0),
      );
    }
  }

  // Dashed yellow centre lines along every road.
  ctx.fillStyle = '#f2c230';
  const dash = 14;
  const gap = 14;
  for (const line of ROAD_LINES) {
    for (let p = 0; p < size; p += dash + gap) {
      ctx.fillRect(p, toPx(line) - 2, dash, 4);
      ctx.fillRect(toPx(line) - 2, p, 4, dash);
    }
  }

  // Crosswalks: white stripes across each road at each intersection.
  ctx.fillStyle = '#e8e8e8';
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(toPx(rx + i * 1.4) - 2, toPx(rz - ROAD_HALF), 4, toPx(ROAD_WIDTH) - toPx(0));
        ctx.fillRect(toPx(rx - ROAD_HALF), toPx(rz + i * 1.4) - 2, toPx(ROAD_WIDTH) - toPx(0), 4);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePalmTree(rng) {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 3.4, 6), trunkMat);
  trunk.position.y = 1.7;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  tree.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.8 });
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 4), frondMat);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 0.9, 3.6, Math.sin(angle) * 0.9);
    frond.rotation.z = Math.cos(angle) * 1.1;
    frond.rotation.x = -Math.sin(angle) * 1.1;
    frond.scale.set(1, 1, 0.25);
    tree.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), frondMat);
  crown.position.y = 3.5;
  crown.scale.y = 0.7;
  tree.add(crown);
  return tree;
}

function makeLamp() {
  const lamp = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), poleMat);
  pole.position.y = 2.3;
  lamp.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.55, 4.55, 0);
  lamp.add(arm);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bulbMat);
  bulb.position.set(1.1, 4.5, 0);
  lamp.add(bulb);
  return lamp;
}

/**
 * Build the whole island into `scene` from the seeded generator.
 * Returns the collision list, the road lines and the Marina beacon mesh,
 * which the game pulses when the objective completes.
 */
export function buildCity(scene, rng) {
  const colliders = [];
  const windowTexture = makeWindowTexture();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const buildingMats = BUILDING_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, map: windowTexture, roughness: 0.85 }),
  );
  const roofMats = ROOF_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );

  // Ocean ring, then the island ground with its painted roads.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x2e7fa8, roughness: 0.35, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.5;
  scene.add(ocean);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Buildings: one to four per block, varied heights and colours.
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      const count = intRange(rng, 1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 8, 16);
        const d = range(rng, 8, 16);
        const h = range(rng, 7, 34);
        const inner = BLOCK_SIZE / 2 - SIDEWALK - Math.max(w, d) / 2 - 1;
        const x = bx + range(rng, -inner, inner) * (count > 1 ? 0.6 : 0);
        const z = bz + range(rng, -inner, inner) * (count > 1 ? 0.6 : 0);
        const mesh = new THREE.Mesh(unitBox, pick(rng, buildingMats));
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        // A flat roof slab in a darker tone, and a rooftop box on tall towers.
        const roof = new THREE.Mesh(unitBox, pick(rng, roofMats));
        roof.scale.set(w + 0.4, 0.5, d + 0.4);
        roof.position.set(x, h + 0.25, z);
        roof.castShadow = true;
        scene.add(roof);
        if (h > 20) {
          const penthouse = new THREE.Mesh(unitBox, pick(rng, buildingMats));
          penthouse.scale.set(w * 0.4, 3, d * 0.4);
          penthouse.position.set(x, h + 2, z);
          penthouse.castShadow = true;
          scene.add(penthouse);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palm trees and lamps along the sidewalks, on the block corners.
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = bx + dx * (BLOCK_SIZE / 2 - 1.2);
        const pz = bz + dz * (BLOCK_SIZE / 2 - 1.2);
        if (rng() < 0.55) {
          const tree = makePalmTree(rng);
          tree.position.set(px, 0, pz);
          tree.castShadow = true;
          scene.add(tree);
        } else if (rng() < 0.5) {
          const lamp = makeLamp();
          lamp.position.set(px, 0, pz);
          lamp.rotation.y = rng() * Math.PI * 2;
          scene.add(lamp);
        }
      }
    }
  }

  // The Marina: a wooden pier reaching into the water on the south shore,
  // with a glowing beacon column marking the objective.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.9 });
  for (let i = 0; i < 8; i += 1) {
    const plank = new THREE.Mesh(unitBox, pierMat);
    plank.scale.set(6, 0.3, 2.4);
    plank.position.set(MARINA.x, 0.35, MARINA.z + 9 + i * 2.4);
    plank.castShadow = true;
    scene.add(plank);
  }
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffd94d, emissive: 0xffc21a, emissiveIntensity: 1.2, transparent: true, opacity: 0.35,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 26, 12, 1, true), beaconMat);
  beacon.position.set(MARINA.x, 13, MARINA.z);
  scene.add(beacon);
  const beaconBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a6f5c, roughness: 0.9 }),
  );
  beaconBase.position.set(MARINA.x, 0.4, MARINA.z);
  scene.add(beaconBase);

  // A couple of moored boats beside the pier, for the skyline.
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  for (const [bx, bz] of [[-9, 168], [9, 172]]) {
    const hull = new THREE.Mesh(unitBox, hullMat);
    hull.scale.set(3, 1.2, 7);
    hull.position.set(bx, 0.1, bz);
    scene.add(hull);
  }

  return { colliders, beacon };
}

/** True when a circle of `radius` at (x, z) would touch a building or leave the island. */
export function isBlocked(colliders, x, z, radius) {
  if (Math.abs(x) > CITY_HALF - 2 || Math.abs(z) > CITY_HALF - 2) return true;
  for (const box of colliders) {
    if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
      return true;
    }
  }
  return false;
}

/** The four sidewalk corners of one block, for pedestrians to walk around. */
export function sidewalkLoop(bx, bz) {
  const edge = BLOCK_SIZE / 2 - 1.5;
  return [
    { x: bx - edge, z: bz - edge },
    { x: bx + edge, z: bz - edge },
    { x: bx + edge, z: bz + edge },
    { x: bx - edge, z: bz + edge },
  ];
}

/**
 * A point on a road behind (x, z) along `heading`, about `distance` metres
 * back: step back from the target, then snap to the nearest road line, so a
 * police cruiser starts on a road with a clear run at the player instead of
 * across a block of buildings.
 */
export function roadPointBehind(x, z, heading, distance) {
  const bx = x - Math.sin(heading) * distance;
  const bz = z - Math.cos(heading) * distance;
  let bestLine = ROAD_LINES[0];
  let bestDistance = Infinity;
  let vertical = true;
  for (const line of ROAD_LINES) {
    if (Math.abs(line - bx) < bestDistance) {
      bestDistance = Math.abs(line - bx);
      bestLine = line;
      vertical = true;
    }
    if (Math.abs(line - bz) < bestDistance) {
      bestDistance = Math.abs(line - bz);
      bestLine = line;
      vertical = false;
    }
  }
  const px = vertical ? bestLine : Math.max(-CITY_HALF + 8, Math.min(CITY_HALF - 8, bx));
  const pz = vertical
    ? Math.max(-CITY_HALF + 8, Math.min(CITY_HALF - 8, bz))
    : bestLine;
  return { x: px, z: pz };
}
