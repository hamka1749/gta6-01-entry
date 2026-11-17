// SUNSET KEYS — the minimap, a 2D canvas in the top-right corner.
// Roads, buildings, the ocean edge, the Marina star, traffic cars as dots
// and the player as a white arrow that turns with them. Redrawn every frame
// from the same layout data the 3D city was built from.

import { CITY_HALF, CITY_SIZE, MARINA } from './config.js';
import { BLOCK_CENTRES, ROAD_LINES } from './city.js';

const MAP_SIZE = 180;

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext('2d');
  const scale = MAP_SIZE / CITY_SIZE;
  const toMap = (world) => (world + CITY_HALF) * scale;

  function drawRoads() {
    ctx.fillStyle = '#274b63'; // ocean ring around the island
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#3f6b52'; // island ground
    const margin = toMap(-CITY_HALF);
    ctx.fillRect(margin, margin, MAP_SIZE - margin * 2, MAP_SIZE - margin * 2);
    ctx.strokeStyle = '#5a6b7a';
    ctx.lineWidth = 5;
    for (const line of ROAD_LINES) {
      ctx.beginPath();
      ctx.moveTo(0, toMap(line));
      ctx.lineTo(MAP_SIZE, toMap(line));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toMap(line), 0);
      ctx.lineTo(toMap(line), MAP_SIZE);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a8b7a';
    for (const bx of BLOCK_CENTRES) {
      for (const bz of BLOCK_CENTRES) {
        ctx.fillRect(toMap(bx - 15), toMap(bz - 15), 30 * scale, 30 * scale);
      }
    }
  }

  function drawMarina(simTime, objectiveActive) {
    const x = toMap(MARINA.x);
    const y = toMap(MARINA.z);
    // While the getaway is still on, a gold ring breathes around the
    // Marina on the simulation clock, so the goal is findable at a glance.
    if (objectiveActive) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9 + Math.sin(simTime * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2b36';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y);
  }

  function drawCars(cars) {
    for (const car of cars) {
      ctx.fillStyle = car.driven ? '#ffffff' : '#f2c230';
      ctx.beginPath();
      ctx.arc(toMap(car.x), toMap(car.z), car.driven ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Police cruisers as blue dots; pedestrians as small pale dots. */
  function drawPolice(police) {
    for (const car of police) {
      ctx.fillStyle = '#4d8dff';
      ctx.beginPath();
      ctx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPedestrians(pedestrians) {
    ctx.fillStyle = '#cfe8f5';
    for (const ped of pedestrians) {
      ctx.beginPath();
      ctx.arc(toMap(ped.x), toMap(ped.z), 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(player, driving) {
    const x = toMap(player.x);
    const y = toMap(player.z);
    ctx.save();
    ctx.translate(x, y);
    // The arrow is drawn pointing up (-y); world heading 0 faces +z, which
    // is down on the map, so turn it half a circle further.
    ctx.rotate(player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d2b36';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    /**
     * `police` and `pedestrians` are optional: the title screen passes
     * none. `simTime` drives the objective ring; `objectiveActive` says
     * whether the getaway is still on.
     */
    draw(player, cars, driving, police = [], pedestrians = [], simTime = 0, objectiveActive = false) {
      drawRoads();
      drawMarina(simTime, objectiveActive);
      drawCars(cars);
      drawPolice(police);
      drawPedestrians(pedestrians);
      drawPlayer(player, driving);
    },
  };
}
