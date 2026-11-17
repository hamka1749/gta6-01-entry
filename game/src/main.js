// SUNSET KEYS — boot and the one game loop.
// Builds the island, the player and the cars from the seed, then runs the
// loop: read input, step the player or the driven car and the traffic, move
// the camera, and paint the HUD and minimap. The game has two screens:
// the title screen and play. ?seed=N fixes the island; ?shot=start|play|end
// (with &seed=N) stages that scene instead of running the loop, renders it a
// few times and sets window.__shotReady for a screenshot.

import * as THREE from 'three';
import {
  CAR_TOP_SPEED, CITY_NAME, DEFAULT_SEED, GAME_TITLE, MARINA,
  MARINA_RADIUS, SKY_COLOR, SUN_COLOR,
} from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createTraffic, nearestCar, stepDrivenCar, stepTraffic } from './vehicles.js';
import { createCamera } from './camera.js';
import { ACTION_ENTER, ACTION_RESET, createInput } from './input.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const OBJECTIVE_TEXT = '★ Find a car, then drive to the Marina — follow the gold beacon';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 220, 700);

const sun = new THREE.DirectionalLight(SUN_COLOR, 2.4);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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

const rng = makeRng(seed);
const city = buildCity(scene, rng);
const player = createPlayer(scene);
const cars = createTraffic(scene, rng);
const camera = createCamera(renderer);
const input = createInput(canvas);
const hud = createHud();
const minimap = createMinimap();
const audio = createAudio();

const game = {
  player,
  cars,
  colliders: city.colliders,
  camera,
  hud,
  driving: null,
  screen: 'title',
  objectiveDone: false,

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
    hud.setObjective('★ Drive to the Marina — follow the gold beacon');
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
    hud.setObjective('★ Marina reached — nice driving. More of Palmera Keys is yours to explore.');
    hud.showBanner('★ MARINA REACHED');
    audio.objectiveDone();
  },
};

// Debug hook for automated play-testing (headless Chromium drives the real
// game through this handle: teleport, press keys, read speed and position).
window.__sunsetKeys = game;

function stepWorld(dt) {
  const move = input.move();
  const actions = input.takeActions();
  camera.applyDrag(input.takeDrag());

  if (actions & ACTION_RESET) {
    if (game.driving) game.exitCar();
    player.reset();
    hud.hideBanner();
  }
  if (actions & ACTION_ENTER) {
    if (game.driving) game.exitCar();
    else {
      const car = nearestCar(cars, player.state.x, player.state.z);
      if (car) game.enterCar(car);
    }
  }

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
    if (car) hud.showPrompt('Press E to get in the car');
    else hud.hidePrompt();
  }

  stepTraffic(cars, dt);
  audio.setEngine(game.driving ? Math.abs(game.driving.speed) / CAR_TOP_SPEED : 0);

  const target = game.driving
    ? { x: game.driving.x, z: game.driving.z, driving: true }
    : { x: player.state.x, z: player.state.z, driving: false };
  camera.follow(target, game.driving ? 1 : 1.6, dt);
  minimap.draw(game.driving ? game.driving : player.state, cars, Boolean(game.driving));

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
  minimap.draw(game.driving ? game.driving : player.state, cars, Boolean(game.driving));
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

  function frame(now) {
    requestAnimationFrame(frame);
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
      camera.follow({ x: player.state.x, z: player.state.z, driving: false }, 1.6, STEP);
      minimap.draw(player.state, cars, false);
    }
    renderFrame();
  }

  window.addEventListener('resize', () => camera.resize());
  camera.resize();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
