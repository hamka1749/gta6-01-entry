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
