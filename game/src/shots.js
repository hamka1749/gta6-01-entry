// SUNSET KEYS — the deterministic screenshot poses behind ?shot=start|play|chase|end.
// Each pose sets up a fixed scene from the seeded world and then advances it
// a fixed number of fixed-size steps, so the same seed always renders the
// same frame: no input, no wall clock, no randomness at shot time.
//   start — the title screen over the island, the player on a sidewalk.
//   play  — mid-drive: the player has taken a car and is cruising a road.
//   chase — the getaway: a stolen car at speed, two cruisers in pursuit.
//   end   — the Marina objective complete, player beside the car on the pier.

import { CAMERA_DISTANCE, MARINA, MISSION_WANTED_TEXT } from './config.js';
import { nearestCar, policeSpawnPoint, stepDrivenCar, stepTraffic } from './vehicles.js';

const STEP = 1 / 60;
const PLAY_STEPS = 240; // four seconds of driving, fixed
const CHASE_STEPS = 240; // four seconds of chase, fixed

/** Drive the car straight along its road for a fixed number of steps. */
function driveForward(game, steps) {
  const move = { forward: 1, strafe: 0, run: false, brake: false };
  for (let i = 0; i < steps; i += 1) {
    stepDrivenCar(game.driving, STEP, move, game.colliders);
    stepTraffic(game.cars, STEP);
    game.stepSystems(STEP);
  }
}

/** The parked car nearest the player, or null when there is none. */
function nearestParkedCar(game) {
  let parked = null;
  let parkedDistance = Infinity;
  for (const car of game.cars) {
    if (car.traffic) continue;
    const distance = Math.hypot(car.x - game.player.state.x, car.z - game.player.state.z);
    if (distance < parkedDistance) {
      parkedDistance = distance;
      parked = car;
    }
  }
  return parked;
}

/** Walk the player to the nearest parked car and get in it. */
function enterNearestCar(game) {
  const parked = nearestParkedCar(game);
  if (!parked) return;
  game.player.teleport(parked.x + 2, parked.z, parked.heading);
  const car = nearestCar(game.cars, game.player.state.x, game.player.state.z);
  if (!car) return;
  game.enterCar(car);
  game.camera.state.yaw = car.heading + Math.PI;
  game.camera.state.pitch = 0.3;
  game.camera.state.distance = CAMERA_DISTANCE + 2;
}

/**
 * Stage the named pose on the live game object and return how many frames
 * the caller should render before the shot is taken.
 */
export function stageShot(name, game) {
  if (name === 'play') {
    game.startPlaying();
    enterNearestCar(game);
    if (game.driving) driveForward(game, PLAY_STEPS);
    game.hud.setObjective(MISSION_WANTED_TEXT);
    game.camera.snap({ x: game.driving.x, z: game.driving.z, driving: true }, 1);
    return 3;
  }
  if (name === 'chase') {
    game.startPlaying();
    enterNearestCar(game);
    if (game.driving) {
      // A two-star chase for the shot: the steal already brought one
      // cruiser; a second one joins from the same road behind the getaway
      // car, rolling — spawned the way the game spawns them, not placed.
      game.wanted = 2;
      game.hud.setWanted(2);
      const behind = policeSpawnPoint(game.driving, 16);
      game.addPoliceAt(behind.x, behind.z, game.driving.heading, 18);
      driveForward(game, CHASE_STEPS);
      game.hud.setObjective(MISSION_WANTED_TEXT);
      // Side view: the getaway car ahead, the cruisers trailing behind it.
      game.camera.state.yaw = game.driving.heading + Math.PI / 2;
      game.camera.state.pitch = 0.32;
      game.camera.state.distance = CAMERA_DISTANCE + 4;
      game.camera.snap({ x: game.driving.x, z: game.driving.z, driving: true }, 1);
      return 3;
    }
    // No car found (should not happen): fall through to the start pose.
  }
  if (name === 'end') {
    game.startPlaying();
    // Park a car at the Marina and stand the player beside it on the pier.
    const parked = nearestParkedCar(game);
    if (parked) {
      parked.x = MARINA.x + 4;
      parked.z = MARINA.z - 6;
      parked.heading = Math.PI;
      parked.mesh.position.set(parked.x, 0, parked.z);
      parked.mesh.rotation.y = parked.heading;
    }
    game.player.teleport(MARINA.x - 2, MARINA.z + 2, 0.9);
    game.completeObjective();
    game.camera.state.yaw = 0.9;
    game.camera.state.pitch = 0.55;
    game.camera.state.distance = 13;
    game.camera.snap({ x: game.player.state.x, z: game.player.state.z, driving: false }, 1.6);
    return 3;
  }
  // start (and any unknown name): title screen over the island.
  game.camera.state.yaw = 0.7;
  game.camera.state.pitch = 0.42;
  game.camera.state.distance = 13;
  game.camera.snap({ x: game.player.state.x, z: game.player.state.z, driving: false }, 1.6);
  return 3;
}
