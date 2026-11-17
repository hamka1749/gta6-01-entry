// SUNSET KEYS — boot and the one game loop.
// Builds the island, the player, the cars, the police and the pedestrians
// from the seed, then runs the loop: read input, step the player or the
// driven car, the traffic, the police chase and the wanted level, move the
// camera, and paint the HUD and minimap. The game has two screens: the
// title screen and play. ?seed=N fixes the island; ?shot=start|play|chase|end
// (with &seed=N) stages that scene instead of running the loop, renders it a
// few times and sets window.__shotReady for a screenshot. ?quality=low
// forces the small shadow map from the first frame.
//
// The mission, "The Getaway": steal a car and the wanted level rises, the
// police chase and ram the car, and the run ends at the Marina (complete)
// or in cuffs (busted). R restarts the run.

import * as THREE from 'three';
import {
  BUSTED_DISTANCE, BUSTED_FOOT_SECONDS, BUSTED_HOLD_SECONDS, CAR_TOP_SPEED,
  CITY_NAME, DEFAULT_SEED, GAME_TITLE, MARINA, MARINA_RADIUS,
  MISSION_CLEAN_TEXT, MISSION_DONE_TEXT, MISSION_TEXT, MISSION_WANTED_TEXT,
  POLICE_RAM_DISTANCE, POLICE_SPAWN_DISTANCE, QUALITY_SAMPLE_FRAMES,
  QUALITY_SLOW_FRAME_MS, SHADOW_MAP_HIGH, SHADOW_MAP_LOW, SKY_COLOR, SUN_COLOR,
  WANTED_ESCAPE_DISTANCE, WANTED_ESCAPE_SECONDS, WANTED_MAX_STARS, WANTED_STAR_SECONDS,
} from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { createPedestrians, stepPedestrians } from './character.js';
import { createPlayer } from './player.js';
import {
  createPolice, createTraffic, nearestCar, policeSpawnPoint, removePolice,
  stepDrivenCar, stepPolice, stepTraffic,
} from './vehicles.js';
import { createCamera } from './camera.js';
import { ACTION_ENTER, ACTION_HORN, ACTION_RESET, createInput } from './input.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const OBJECTIVE_TEXT = MISSION_TEXT;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;
const qualityLow = params.get('quality') === 'low';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// One fixed pixel ratio keeps the frame cost predictable across machines.
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 220, 700);

const sun = new THREE.DirectionalLight(SUN_COLOR, 2.4);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(
  qualityLow ? SHADOW_MAP_LOW : SHADOW_MAP_HIGH,
  qualityLow ? SHADOW_MAP_LOW : SHADOW_MAP_HIGH,
);
sun.shadow.camera.left = -190;
sun.shadow.camera.right = 190;
sun.shadow.camera.top = 190;
sun.shadow.camera.bottom = -190;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xbfd9e8, 0.7));
const skyFill = new THREE.HemisphereLight(0x9fd0e8, 0xd9c49a, 0.5);
scene.add(skyFill);

/** Drop to the small shadow map on a weak machine (rendering only). */
function applyLowQuality() {
  if (game.quality === 'low') return;
  game.quality = 'low';
  sun.shadow.mapSize.set(SHADOW_MAP_LOW, SHADOW_MAP_LOW);
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
}

const rng = makeRng(seed);
// A second seeded generator for runtime events (police spawns): the same
// seed and the same player actions always spawn the same chase.
const runtimeRng = makeRng((seed * 7919 + 13) >>> 0);
const city = buildCity(scene, rng);
const player = createPlayer(scene);
const pedestrians = createPedestrians(scene, runtimeRng);
const cars = createTraffic(scene, rng);
const camera = createCamera(renderer);
const input = createInput(canvas);
const hud = createHud();
const minimap = createMinimap();
const audio = createAudio();

const game = {
  player,
  cars,
  police: [],
  pedestrians,
  colliders: city.colliders,
  camera,
  hud,
  driving: null,
  screen: 'title',
  objectiveDone: false,
  // The mission state machine: 'active' | 'complete' | 'busted'.
  mission: 'active',
  wanted: 0,
  wantedTimer: 0,
  escapeTimer: 0,
  bustedTimer: 0,
  ramCount: 0,
  simTime: 0,
  quality: qualityLow ? 'low' : 'high',
  qualityChecked: qualityLow,

  startPlaying() {
    this.screen = 'playing';
    hud.hideStart();
    hud.setObjective(OBJECTIVE_TEXT);
    audio.unlock();
  },

  enterCar(car) {
    this.driving = car;
    car.driven = true;
    car.speed = 0;
    player.hide();
    camera.state.yaw = car.heading + Math.PI;
    audio.enterCar();
    this.onCarTaken();
  },

  /** Taking a car is stealing: the first star and the first cruiser. */
  onCarTaken() {
    if (this.mission !== 'active') return;
    if (this.wanted === 0) {
      this.wanted = 1;
      this.wantedTimer = 0;
      this.spawnPolice(1);
      hud.setWanted(1);
      hud.setObjective(MISSION_WANTED_TEXT);
      audio.wantedUp();
    } else {
      hud.setObjective(MISSION_WANTED_TEXT);
    }
  },

  /** Spawn `count` cruisers on roads near the target (car or player). */
  spawnPolice(count, distance = POLICE_SPAWN_DISTANCE) {
    const target = this.driving ?? this.player.state;
    for (let i = 0; i < count; i += 1) {
      const point = policeSpawnPoint(target, distance);
      const heading = Math.atan2(target.x - point.x, target.z - point.z);
      this.police.push(createPolice(scene, point.x, point.z, heading));
    }
  },

  /** Place one cruiser exactly at (x, z) — used by the staged chase shot. */
  addPoliceAt(x, z, heading, speed = 0) {
    const cruiser = createPolice(scene, x, z, heading);
    cruiser.speed = speed;
    this.police.push(cruiser);
    return cruiser;
  },

  exitCar() {
    const car = this.driving;
    if (!car) return;
    car.driven = false;
    car.speed = 0;
    this.driving = null;
    player.teleport(car.x + Math.cos(car.heading) * 2.6, car.z - Math.sin(car.heading) * 2.6, car.heading);
    player.show();
    audio.exitCar();
  },

  completeObjective() {
    if (this.objectiveDone) return;
    this.objectiveDone = true;
    this.completeMission();
  },

  /** The Marina reached: the getaway is complete, the cops stand down. */
  completeMission() {
    this.mission = 'complete';
    removePolice(scene, this.police);
    this.wanted = 0;
    hud.setWanted(0);
    hud.setObjective(MISSION_DONE_TEXT);
    hud.showBanner('★ GETAWAY COMPLETE');
    audio.objectiveDone();
  },

  /** Held by the police: the run ends, R tries again. */
  bust() {
    if (this.mission !== 'active') return;
    this.mission = 'busted';
    if (this.driving) this.driving.speed = 0;
    else player.raiseArms();
    hud.showFailBanner('BUSTED — the cops got you. Press R to try again.');
    audio.busted();
  },

  /** Full run reset: player home, no wanted, no police, mission live again. */
  resetRun() {
    if (this.driving) {
      this.driving.driven = false;
      this.driving.speed = 0;
      this.driving = null;
    }
    removePolice(scene, this.police);
    player.reset();
    player.show();
    this.mission = 'active';
    this.objectiveDone = false;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.escapeTimer = 0;
    this.bustedTimer = 0;
    this.ramCount = 0;
    hud.setWanted(0);
    hud.setObjective(MISSION_TEXT);
    hud.hideBanner();
    camera.state.yaw = player.state.heading + Math.PI;
  },

  /**
   * The chase systems, one fixed step: pedestrians walk, police chase and
   * ram, the wanted level rises with time and falls when the player shakes
   * every cruiser, and a held player gets busted. Shared by the live loop
   * and the staged screenshots, so both see the same chase.
   */
  stepSystems(dt) {
    this.simTime += dt;
    stepPedestrians(this.pedestrians, [...this.cars, ...this.police], dt);
    if (this.mission !== 'active') {
      audio.setSiren(false, 0, this.simTime);
      return;
    }
    const target = this.driving ?? this.player.state;
    const targetSpeed = this.driving ? Math.abs(this.driving.speed) : this.player.state.speed;
    let nearest = Infinity;
    for (const cruiser of this.police) {
      const distance = stepPolice(cruiser, target, dt, this.colliders);
      if (distance < nearest) nearest = distance;
      // Ram: a cruiser touching the driven car cuts its speed and shakes
      // the camera. No positional shove: repeated shoves walk the car off
      // the road into a wall, which is not a fair bust.
      if (this.driving && distance < POLICE_RAM_DISTANCE && cruiser.ramCooldown <= 0) {
        cruiser.ramCooldown = 1.0;
        this.driving.speed *= 0.85;
        this.ramCount += 1;
        this.camera.addShake(0.5);
        audio.thud();
        // Pace the target after the hit instead of driving through it.
        cruiser.speed = Math.min(cruiser.speed, this.driving.speed);
      }
    }
    // Busted: a cruiser parked beside a near-stopped target holds the player.
    // The hold drains instead of snapping to zero, so a ram shove that
    // briefly opens the gap does not erase the whole hold.
    if (this.police.length > 0 && nearest < BUSTED_DISTANCE && targetSpeed < 1) {
      this.bustedTimer += dt;
      const hold = this.driving ? BUSTED_HOLD_SECONDS : BUSTED_FOOT_SECONDS;
      if (this.bustedTimer >= hold) {
        this.bust();
        return;
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    // Wanted: another star every WANTED_STAR_SECONDS, up to the max.
    if (this.wanted > 0) {
      this.wantedTimer += dt;
      if (this.wantedTimer >= WANTED_STAR_SECONDS && this.wanted < WANTED_MAX_STARS) {
        this.wantedTimer = 0;
        this.wanted += 1;
        this.spawnPolice(1);
        hud.setWanted(this.wanted);
        audio.wantedUp();
      }
      // Escape: no cruiser near for WANTED_ESCAPE_SECONDS drops a star;
      // at zero stars the cops leave and the run is a clean getaway.
      if (nearest > WANTED_ESCAPE_DISTANCE) {
        this.escapeTimer += dt;
        if (this.escapeTimer >= WANTED_ESCAPE_SECONDS) {
          this.escapeTimer = 0;
          this.wanted -= 1;
          hud.setWanted(this.wanted);
          if (this.wanted === 0) {
            removePolice(scene, this.police);
            hud.setObjective(MISSION_CLEAN_TEXT);
          }
        }
      } else {
        this.escapeTimer = 0;
      }
    }
    audio.setSiren(this.wanted > 0, nearest, this.simTime);
  },

  /** Advance the world by `seconds` of fixed steps, without rendering. */
  step(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i += 1) stepWorld(STEP);
  },
};

// Debug hook for automated play-testing (headless Chromium drives the real
// game through this handle: teleport, press keys, read speed and position).
window.__sunsetKeys = game;

function stepWorld(dt) {
  const move = input.move();
  const actions = input.takeActions();
  camera.applyDrag(input.takeDrag());

  if (actions & ACTION_HORN) audio.honk();
  if (actions & ACTION_RESET) game.resetRun();
  if (game.mission !== 'busted' && (actions & ACTION_ENTER)) {
    if (game.driving) game.exitCar();
    else {
      const car = nearestCar(cars, player.state.x, player.state.z);
      if (car) game.enterCar(car);
    }
  }

  if (game.mission !== 'busted') {
    if (game.driving) {
      stepDrivenCar(game.driving, dt, move, city.colliders);
      const distance = Math.hypot(game.driving.x - MARINA.x, game.driving.z - MARINA.z);
      if (distance < MARINA_RADIUS) game.completeObjective();
      hud.setSpeed(Math.abs(game.driving.speed) * 3.6, true);
      hud.hidePrompt();
    } else {
      player.step(dt, move, camera.state.yaw, city.colliders);
      hud.setSpeed(0, false);
      const car = nearestCar(cars, player.state.x, player.state.z);
      if (car) hud.showPrompt('Press E to steal the car');
      else hud.hidePrompt();
    }
  }

  stepTraffic(cars, dt);
  game.stepSystems(dt);
  audio.setEngine(game.driving ? Math.abs(game.driving.speed) / CAR_TOP_SPEED : 0);

  const target = game.driving
    ? { x: game.driving.x, z: game.driving.z, driving: true }
    : { x: player.state.x, z: player.state.z, driving: false };
  camera.follow(target, game.driving ? 1 : 1.6, dt);
  minimap.draw(game.driving ? game.driving : player.state, cars, Boolean(game.driving), game.police, game.pedestrians);

  // The beacon pulses once the objective is done.
  city.beacon.material.emissiveIntensity = game.objectiveDone
    ? 1.6 + Math.sin(performance.now() / 300) * 0.8
    : 1.2;
}

function renderFrame() {
  camera.resize();
  renderer.render(scene, camera.camera);
}

function runShot(name) {
  hud.setObjective(OBJECTIVE_TEXT);
  const frames = stageShot(name, game);
  // Shots never run the loop, so paint the HUD state the loop would own.
  if (game.driving) hud.setSpeed(Math.abs(game.driving.speed) * 3.6, true);
  else hud.setSpeed(0, false);
  minimap.draw(game.driving ? game.driving : player.state, cars, Boolean(game.driving), game.police, game.pedestrians);
  let painted = 0;
  function paint() {
    renderFrame();
    painted += 1;
    if (painted < frames) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  hud.showStart(() => game.startPlaying());
  hud.setObjective(OBJECTIVE_TEXT);
  document.title = `${GAME_TITLE} — ${CITY_NAME}`;
  let accumulator = 0;
  let last = performance.now();
  // Quality fallback: measure the first frames; a slow machine (SwiftShader
  // runs ~1 fps at 1280x720 with 2048 shadow maps) gets smaller shadows.
  let frameCount = 0;
  let frameTimeTotal = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameMs = now - last;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'playing') {
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // The title screen still shows the living island: traffic cruises.
      stepTraffic(cars, STEP);
      game.stepSystems(STEP);
      camera.follow({ x: player.state.x, z: player.state.z, driving: false }, 1.6, STEP);
      minimap.draw(player.state, cars, false, game.police, game.pedestrians);
    }
    if (!game.qualityChecked && game.screen === 'playing') {
      frameCount += 1;
      frameTimeTotal += frameMs;
      if (frameCount >= QUALITY_SAMPLE_FRAMES) {
        game.qualityChecked = true;
        if (frameTimeTotal / frameCount > QUALITY_SLOW_FRAME_MS) applyLowQuality();
      }
    }
    renderFrame();
  }

  window.addEventListener('resize', () => camera.resize());
  camera.resize();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
