// SUNSET KEYS — shared constants for the Palmera Keys open world.
// Every number that shapes the city, the player and the cars lives here,
// so the rest of the game reads like a description of the island.

export const GAME_TITLE = 'SUNSET KEYS';
export const CITY_NAME = 'Palmera Keys';
export const DEFAULT_SEED = 1;

// The island is a square of side CITY_SIZE, ringed by ocean.
export const CITY_SIZE = 360;
export const CITY_HALF = CITY_SIZE / 2;

// Road grid: roads run every ROAD_SPACING units, ROAD_WIDTH wide.
export const ROAD_SPACING = 40;
export const ROAD_WIDTH = 10;
export const ROAD_HALF = ROAD_WIDTH / 2;

// Blocks sit between the roads; buildings keep a sidewalk margin inside them.
export const BLOCK_SIZE = ROAD_SPACING - ROAD_WIDTH;
export const SIDEWALK = 3;

// The Marina — the CP1 objective — sits on the south shore.
export const MARINA = { x: 0, z: 148 };
export const MARINA_RADIUS = 14;

// Player spawn: a sidewalk corner near the middle of town.
export const SPAWN = { x: -14, z: -14, heading: Math.PI * 0.75 };

// On-foot movement.
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 8.0;
export const PLAYER_RADIUS = 0.55;

// Driving.
export const CAR_TOP_SPEED = 28; // m/s, about 100 km/h
export const CAR_ACCEL = 12;
export const CAR_BRAKE = 26;
export const CAR_REVERSE_SPEED = 8;
export const CAR_TURN_RATE = 1.9; // radians per second at full lock
export const ENTER_CAR_RANGE = 3.6;

// Wanted level + police. Taking a car is stealing: the first star and the
// first cruiser arrive with it. Stars rise while the chase runs; the cops
// give up only when none of them is near the player for a while.
export const WANTED_MAX_STARS = 3;
export const WANTED_STAR_SECONDS = 25; // seconds of wanted before another star
export const WANTED_ESCAPE_DISTANCE = 60; // metres with no police near
export const WANTED_ESCAPE_SECONDS = 10; // ...for this long, and a star drops
export const POLICE_TOP_SPEED = 30; // m/s, a touch faster than the player's car
export const POLICE_ACCEL = 14;
export const POLICE_TURN_RATE = 2.3; // radians per second at full lock
export const POLICE_RAM_DISTANCE = 4.2; // centre-to-centre bumper contact (cars are ~4.2 m long)
export const POLICE_SPAWN_DISTANCE = 45; // metres from the player, on a road
export const POLICE_STUCK_SECONDS = 2; // wedged on a building this long...
export const POLICE_STUCK_HOLD = 5; // ...and the cruiser sits still this long
export const BUSTED_HOLD_SECONDS = 3; // police beside a stopped car
export const BUSTED_FOOT_SECONDS = 2; // police beside the player on foot
export const BUSTED_DISTANCE = 3.5;

// Pedestrians: islanders strolling the sidewalks who scatter from cars.
export const PEDESTRIAN_COUNT = 8;
export const PEDESTRIAN_WALK_SPEED = 1.3;
export const PEDESTRIAN_FLEE_SPEED = 2.6;
export const PEDESTRIAN_FLEE_DISTANCE = 6;
export const PEDESTRIAN_FLEE_SECONDS = 2;

// Quality fallback: a weak machine (SwiftShader runs ~1 fps at 1280x720 with
// 2048 shadow maps) gets smaller shadows instead of a slideshow. Rendering
// only — the simulation keeps its fixed 1/60 s steps either way.
export const SHADOW_MAP_HIGH = 2048;
export const SHADOW_MAP_LOW = 1024;
export const QUALITY_SAMPLE_FRAMES = 90;
export const QUALITY_SLOW_FRAME_MS = 40; // average frame time that triggers low

// The mission: steal a car, lose the cops, reach the Marina.
export const MISSION_TEXT = '★ Steal a car, lose the cops, and reach the Marina';
export const MISSION_WANTED_TEXT = '★ WANTED — lose the cops and reach the Marina';
export const MISSION_CLEAN_TEXT = '★ Clean getaway — reach the Marina';
export const MISSION_DONE_TEXT = '★ Getaway complete — Palmera Keys is yours to explore.';

// Third-person camera.
export const CAMERA_DISTANCE = 7.5;
export const CAMERA_MIN_DISTANCE = 4;
export const CAMERA_MAX_DISTANCE = 14;
export const CAMERA_HEIGHT = 2.6;

// Palette: sun-soaked stucco, coral, teal and sand — an island key, not a grey city.
export const BUILDING_COLORS = [
  0xf2e3c6, // sand stucco
  0xf6a08c, // coral
  0x7fc4bd, // sea teal
  0xffffff, // white
  0xf7d774, // sunny yellow
  0xe08e79, // terracotta
  0x9db8d2, // pale blue
  0xc9a0c8, // soft lilac
];
export const ROOF_COLORS = [0x8a6f5c, 0x5c6e7a, 0x7a4a3a, 0x4a5a6a];

export const CAR_COLORS = [
  0xd23b2e, // cherry red
  0x2e6fd2, // ocean blue
  0xf2c230, // taxi yellow
  0x3aa655, // palm green
  0xe8e8e8, // pearl white
  0x22242a, // midnight black
  0xe07840, // sunset orange
  0x7a4fd0, // violet
];

export const SKY_COLOR = 0x87c5e8;
export const SUN_COLOR = 0xfff2d8;
export const OCEAN_COLOR = 0x2e7fa8;
export const SAND_COLOR = 0xd9c49a;
export const GRASS_COLOR = 0x69a85c;
export const ASPHALT_COLOR = 0x3a3f46;
