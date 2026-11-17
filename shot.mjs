// SUNSET KEYS — screenshot + play-test driver, kept in the entry repo.
// Serves game/ with the repo's own serve.ts, opens it in headless Chromium
// (SwiftShader), and either renders the four deterministic ?shot= poses into
// screenshots/ or drives the real game through keyboard input and the
// window.__sunsetKeys debug hook, asserting the core loop holds.
//
// Usage (from the repo root):
//   node shot.mjs shots      — render 1-start, 2-play, 3-end, 4-chase
//   node shot.mjs playtest   — CP1 + CP2 checks: walk, drive, steal, chase,
//                              escalation, Marina, reset, busted, escape
//   node shot.mjs cp3        — CP3 checks: save/load, restart, on-foot combat
//   node shot.mjs all        — shots + playtest + cp3
// A failed check prints FAIL and the process exits non-zero at the end.

import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun-solana/shot-tools/node_modules/playwright-core');

const REPO = fileURLToPath(new URL('.', import.meta.url));
const SHOTS_DIR = join(REPO, 'screenshots');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const PORT = 8080;
const BASE = `http://localhost:${PORT}`;

const SHOTS = [
  { name: '1-start.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-end.jpg', query: '?shot=end&seed=1' },
  { name: '4-chase.jpg', query: '?shot=chase&seed=1' },
];

let failures = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

function watchErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function takeShots(browser) {
  console.log('shots:');
  mkdirSync(SHOTS_DIR, { recursive: true });
  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = watchErrors(page);
    await page.goto(`${BASE}/index.html${shot.query}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
    } catch {
      console.log(`  ${shot.name}: __shotReady never fired`);
    }
    await sleep(400);
    await page.screenshot({ path: join(SHOTS_DIR, shot.name), type: 'jpeg', quality: 80 });
    const bytes = statSync(join(SHOTS_DIR, shot.name)).size;
    console.log(`  ${shot.name}: ${bytes} bytes, console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    check(`${shot.name} under 256 KiB`, bytes <= 262144, `${bytes} bytes`);
    check(`${shot.name} zero console errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
}

// Read the live chase state out of the game in one go.
async function chaseState(page) {
  return page.evaluate(() => {
    const g = window.__sunsetKeys;
    const target = g.driving ?? g.player.state;
    let nearest = null;
    for (const p of g.police) {
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      if (nearest === null || d < nearest) nearest = d;
    }
    return {
      wanted: g.wanted,
      police: g.police.length,
      mission: g.mission,
      ramCount: g.ramCount,
      nearestPolice: nearest === null ? null : +nearest.toFixed(1),
      driving: Boolean(g.driving),
      carSpeed: g.driving ? +g.driving.speed.toFixed(1) : 0,
      stars: document.getElementById('wanted').textContent,
      banner: document.getElementById('banner').textContent,
      bannerHidden: document.getElementById('banner').classList.contains('hidden'),
      objective: document.getElementById('objective').textContent,
    };
  });
}

async function teleportToNearestParkedCar(page) {
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    let best = null;
    let bestD = Infinity;
    for (const car of g.cars) {
      if (car.traffic) continue;
      const d = Math.hypot(car.x - g.player.state.x, car.z - g.player.state.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    g.player.teleport(best.x + 2, best.z, best.heading);
  });
}

async function playtest(browser) {
  console.log('playtest (CP1 + CP2):');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  await page.goto(`${BASE}/index.html?seed=1`, { waitUntil: 'load' });
  await sleep(1500);
  const stepSim = (seconds) => page.evaluate((s) => window.__sunsetKeys.step(s), seconds);
  const gameState = () => page.evaluate(() => {
    const g = window.__sunsetKeys;
    return {
      screen: g.screen,
      driving: Boolean(g.driving),
      player: { x: +g.player.state.x.toFixed(1), z: +g.player.state.z.toFixed(1) },
      carSpeed: g.driving ? +g.driving.speed.toFixed(1) : 0,
      carPos: g.driving ? { x: +g.driving.x.toFixed(1), z: +g.driving.z.toFixed(1) } : null,
      objectiveDone: g.objectiveDone,
      hudSpeed: document.getElementById('speed-value').textContent,
    };
  });

  await page.click('#play-button');
  await sleep(500);
  check('play click starts the game', (await gameState()).screen === 'playing');

  // Pedestrians walk: two sim-seconds move them. Checked before the steal,
  // while no police exist — stopping the car for the count later would let
  // the bust hold accumulate and flake the test.
  const pedBefore = await page.evaluate(() => window.__sunsetKeys.pedestrians.map((p) => [Math.round(p.x), Math.round(p.z)]));
  await stepSim(2);
  const pedAfter = await page.evaluate(() => window.__sunsetKeys.pedestrians.map((p) => [Math.round(p.x), Math.round(p.z)]));
  const pedMoved = pedBefore.filter((pos, i) => pos[0] !== pedAfter[i][0] || pos[1] !== pedAfter[i][1]).length;
  check('pedestrians walk', pedMoved >= 6, `${pedMoved}/${pedBefore.length} moved`);

  // Walk forward for 2 sim-seconds of held W. Fixed steps, not wall-clock
  // sleep: headless SwiftShader renders ~1 fps, so a 2 s sleep would only
  // advance a fraction of a sim-second through the live loop.
  const before = await gameState();
  await page.keyboard.down('KeyW');
  await stepSim(2);
  await page.keyboard.up('KeyW');
  const afterWalk = await gameState();
  const walked = Math.hypot(afterWalk.player.x - before.player.x, afterWalk.player.z - before.player.z);
  check('walking moves the player', walked > 4, `${walked.toFixed(1)} m in 2 s`);

  // Steal the nearest parked car and drive.
  await teleportToNearestParkedCar(page);
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(400);
  const afterSteal = await chaseState(page);
  check('steal gives wanted 1 + 1 cruiser', afterSteal.wanted === 1 && afterSteal.police === 1, JSON.stringify(afterSteal));
  // The cruiser must spawn behind the target, on the target's own road.
  // Spawn and read inside ONE evaluate: the live loop cannot move the
  // cruiser between the two, so the reading is the true spawn point.
  const spawn = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    // Spawn one test cruiser behind the stolen car where it stands — no
    // teleporting the car, or the steal's own cruiser would have to chase
    // it across the blocks and wedge itself before the chase check.
    g.spawnPolice(1);
    const p = g.police[g.police.length - 1];
    const c = g.driving;
    const lines = [-120, -80, -40, 0, 40, 80, 120];
    const onRoad = Math.min(...lines.map((l) => Math.min(Math.abs(l - p.x), Math.abs(l - p.z))));
    const behind = (p.x - c.x) * Math.sin(c.heading) + (p.z - c.z) * Math.cos(c.heading);
    const result = { onRoad: +onRoad.toFixed(2), behind: +behind.toFixed(1), distance: +Math.hypot(p.x - c.x, p.z - c.z).toFixed(1) };
    // Take the test cruiser back out: the steal's own cruiser stays, and
    // the later escalation check must see exactly the cruisers the game made.
    g.police.pop();
    p.mesh.parent.remove(p.mesh);
    return result;
  });
  check('cruiser spawns behind on a road', spawn.onRoad < 0.6 && spawn.behind < 0, JSON.stringify(spawn));
  check('cruiser spawns ~45 m back', spawn.distance > 40 && spawn.distance < 50, `${spawn.distance} m`);

  await page.keyboard.down('KeyW');
  await sleep(3000);
  await page.keyboard.up('KeyW');
  const afterDrive = await gameState();
  check('driving reaches speed', afterDrive.driving && Math.abs(afterDrive.carSpeed) > 5, `${afterDrive.carSpeed} m/s`);
  await page.screenshot({ path: join(REPO, 'playtest.jpg'), type: 'jpeg', quality: 80 });

  // Chase: hold W so the car keeps rolling while the police close in.
  // The live rAF loop also advances the sim, so a stepSim(n) call advances
  // MORE than n sim-seconds — a stopped car near police would get busted.
  const near0 = (await chaseState(page)).nearestPolice;
  await page.keyboard.down('KeyW');
  await stepSim(3);
  await page.keyboard.up('KeyW');
  const afterChase = await chaseState(page);
  check('police close in on the bumper', afterChase.nearestPolice !== null && afterChase.nearestPolice < 12, `${near0} m -> ${afterChase.nearestPolice} m`);
  check('police ram the car', afterChase.ramCount >= 1, `${afterChase.ramCount} rams`);

  // Rolling-chase sample: 5 s of W with the cruiser glued on. Record the
  // closest the cruiser ever gets (must stay a bumper gap, never overlap).
  const chaseSample = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    let minGap = Infinity;
    for (let i = 0; i < 20; i += 1) {
      g.step(0.25);
      for (const p of g.police) {
        const d = Math.hypot(p.x - g.driving.x, p.z - g.driving.z);
        if (d < minGap) minGap = d;
      }
      g.driving.speed = Math.max(g.driving.speed, 20);
    }
    return { minGap: +minGap.toFixed(2) };
  });
  check('cruiser keeps a bumper gap, never overlaps', chaseSample.minGap >= 3.0, `min gap ${chaseSample.minGap} m`);
  // Top speed: put a cruiser 40 m behind a car doing 28 m/s (the player's
  // top speed) on a straight road and let it run 3 s — far away it wants
  // its full 30 m/s, so it must outrun the player's car to close in.
  const topSpeed = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.x = 0;
    g.driving.z = -100;
    g.driving.heading = 0;
    g.driving.speed = 28;
    const p = g.police[0];
    p.x = 0;
    p.z = -140;
    p.heading = 0;
    p.speed = 0;
    // Clear any wedge state from the earlier chase: this measurement is
    // about top speed, not about the stuck hold.
    p.stuckHold = 0;
    p.stillTimer = 0;
    p.lastX = p.x;
    p.lastZ = p.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    let maxCruiserSpeed = 0;
    for (let i = 0; i < 12; i += 1) {
      g.step(0.25);
      g.driving.speed = 28;
      if (p.speed > maxCruiserSpeed) maxCruiserSpeed = p.speed;
    }
    return +maxCruiserSpeed.toFixed(1);
  });
  check('cruiser top speed beats the player car', topSpeed >= 29, `${topSpeed} m/s vs player 28`);

  // Escalation: keep the getaway rolling around the central blocks for 25
  // sim-seconds. Start on the x=0 road and re-aim every quarter second so
  // the loop hugs the roads instead of cutting block corners.
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.x = 0;
    g.driving.z = -100;
    g.driving.heading = 0;
    g.driving.speed = 20;
    const loop = [[0, -40], [0, 40], [40, 40], [40, -40]];
    let corner = 0;
    for (let i = 0; i < 100; i += 1) {
      const [tx, tz] = loop[corner % 4];
      if (Math.hypot(tx - g.driving.x, tz - g.driving.z) < 6) corner += 1;
      const [nx, nz] = loop[corner % 4];
      g.driving.heading = Math.atan2(nx - g.driving.x, nz - g.driving.z);
      g.driving.speed = 20;
      g.step(0.25);
    }
  });
  const afterEscalation = await chaseState(page);
  check('wanted escalates to 2 stars, 2 cruisers', afterEscalation.wanted === 2 && afterEscalation.police === 2, JSON.stringify(afterEscalation));

  // Mission complete: teleport the car to the Marina.
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.x = 0;
    g.driving.z = 140;
  });
  await stepSim(0.5);
  const afterComplete = await chaseState(page);
  check('Marina completes the mission', afterComplete.mission === 'complete' && afterComplete.wanted === 0 && afterComplete.police === 0, JSON.stringify(afterComplete));

  // Reset with R (real key press), then steal again and test BUSTED.
  await page.keyboard.press('KeyR');
  await stepSim(0.5);
  const afterReset = await chaseState(page);
  check('R reset is clean', afterReset.mission === 'active' && afterReset.wanted === 0 && afterReset.police === 0 && afterReset.bannerHidden, JSON.stringify(afterReset));

  await teleportToNearestParkedCar(page);
  await page.keyboard.press('KeyE');
  await stepSim(0.5);
  const afterSteal2 = await chaseState(page);
  check('steal again after reset', afterSteal2.wanted === 1 && afterSteal2.police === 1, JSON.stringify(afterSteal2));
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.speed = 0;
    const p = g.police[0];
    p.x = g.driving.x + 2;
    p.z = g.driving.z;
    p.speed = 0;
    p.mesh.position.set(p.x, 0, p.z);
  });
  await stepSim(4);
  const afterBusted = await chaseState(page);
  check('held by police = busted', afterBusted.mission === 'busted' && !afterBusted.bannerHidden, JSON.stringify(afterBusted));
  await page.screenshot({ path: join(REPO, 'playtest', 'busted.jpg'), type: 'jpeg', quality: 80 });

  // Stuck mechanic: wedge the cruiser inside a building; after 2 s it
  // must be sitting still on its stuck hold.
  await page.keyboard.press('KeyR');
  await stepSim(0.5);
  await teleportToNearestParkedCar(page);
  await page.keyboard.press('KeyE');
  await stepSim(0.5);
  const stuck = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    let biggest = g.colliders[0];
    for (const box of g.colliders) {
      const area = (box.maxX - box.minX) * (box.maxZ - box.minZ);
      const best = (biggest.maxX - biggest.minX) * (biggest.maxZ - biggest.minZ);
      if (area > best) biggest = box;
    }
    const p = g.police[0];
    p.x = (biggest.minX + biggest.maxX) / 2;
    p.z = (biggest.minZ + biggest.maxZ) / 2;
    p.heading = 0;
    p.speed = 0;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    g.step(2.5);
    return { stuckHold: +p.stuckHold.toFixed(2), speed: +p.speed.toFixed(2) };
  });
  check('wedged cruiser sits out its stuck hold', stuck.stuckHold > 0 && stuck.speed === 0, JSON.stringify(stuck));

  // Escape: cruiser wedged far away, player car 100+ m off, 11 s of escape
  // timer — a star drops and the cops leave.
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    const p = g.police[0];
    g.driving.x = p.x > 0 ? p.x - 120 : p.x + 120;
    g.driving.z = p.z > 0 ? p.z - 120 : p.z + 120;
  });
  await stepSim(11);
  const afterEscape = await chaseState(page);
  check('escape drops the star, cops leave', afterEscape.wanted === 0 && afterEscape.police === 0, JSON.stringify(afterEscape));

  check('playtest zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function cp3test(browser) {
  console.log('cp3 (save/load, restart, combat):');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  await page.goto(`${BASE}/index.html?seed=1`, { waitUntil: 'load' });
  await sleep(1500);
  const stepSim = (seconds) => page.evaluate((s) => window.__sunsetKeys.step(s), seconds);

  // --- Save/load: steal a car, drive, save with X, reload, continue. ---
  await page.click('#play-button');
  await sleep(400);
  await teleportToNearestParkedCar(page);
  await page.keyboard.press('KeyE');
  await sleep(300);
  await page.keyboard.down('KeyW');
  await sleep(2000);
  await page.keyboard.up('KeyW');
  const beforeSave = await chaseState(page);
  check('save setup: wanted 1, driving', beforeSave.wanted === 1 && beforeSave.driving, JSON.stringify(beforeSave));
  const savedPos = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    return { x: +g.driving.x.toFixed(1), z: +g.driving.z.toFixed(1), speed: +g.driving.speed.toFixed(1) };
  });
  await page.keyboard.press('KeyX');
  await sleep(300);
  const saveRaw = await page.evaluate(() => localStorage.getItem('sunset-keys-save-v1'));
  check('X writes a save to localStorage', typeof saveRaw === 'string' && saveRaw.length > 20, saveRaw ? `${saveRaw.length} chars` : 'none');
  const savedToast = await page.evaluate(() => document.getElementById('save-toast').textContent);
  check('save shows a toast', /saved/i.test(savedToast), savedToast);

  // Reload the page: the title screen must offer Continue, and it must
  // restore the run — same wanted, same car, same neighbourhood.
  await page.reload({ waitUntil: 'load' });
  await sleep(1200);
  const continueVisible = await page.evaluate(() => {
    const b = document.getElementById('continue-button');
    return b && !b.classList.contains('hidden');
  });
  check('title screen offers Continue after reload', continueVisible === true);
  await page.click('#continue-button');
  await sleep(500);
  const afterLoad = await chaseState(page);
  const loadedPos = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    return g.driving ? { x: +g.driving.x.toFixed(1), z: +g.driving.z.toFixed(1) } : null;
  });
  const loadGap = loadedPos ? Math.hypot(loadedPos.x - savedPos.x, loadedPos.z - savedPos.z) : Infinity;
  check('Continue restores wanted + driving', afterLoad.wanted === 1 && afterLoad.driving && afterLoad.police >= 1, JSON.stringify(afterLoad));
  check('Continue restores the position', loadGap < 5, `moved ${loadGap.toFixed(1)} m from the save`);

  // --- Restart from every end state: complete, busted, escaped. ---
  // Complete: drive to the Marina, then R.
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.x = 0;
    g.driving.z = 140;
  });
  await stepSim(0.5);
  check('complete before restart check', (await chaseState(page)).mission === 'complete');
  // A completed run can be saved and continued: after a reload, Continue
  // must bring the getaway back as complete, not as a fresh steal-a-car run.
  await page.keyboard.press('KeyX');
  await sleep(300);
  await page.reload({ waitUntil: 'load' });
  await sleep(1200);
  await page.click('#continue-button');
  await sleep(500);
  const continued = await chaseState(page);
  check('Continue after complete keeps the getaway complete', continued.mission === 'complete' && continued.objective === '★ Getaway complete — Palmera Keys is yours to explore.', JSON.stringify(continued));
  await page.keyboard.press('KeyR');
  await stepSim(0.5);
  let reset = await chaseState(page);
  check('R after complete is clean', reset.mission === 'active' && reset.wanted === 0 && reset.police === 0 && reset.bannerHidden && !reset.driving, JSON.stringify(reset));

  // Busted: steal, park a cruiser beside the stopped car, wait, then R.
  await teleportToNearestParkedCar(page);
  await page.keyboard.press('KeyE');
  await stepSim(0.5);
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    g.driving.speed = 0;
    const p = g.police[0];
    p.x = g.driving.x + 2;
    p.z = g.driving.z;
    p.speed = 0;
    p.mesh.position.set(p.x, 0, p.z);
  });
  await stepSim(4);
  check('busted before restart check', (await chaseState(page)).mission === 'busted');
  await page.keyboard.press('KeyR');
  await stepSim(0.5);
  reset = await chaseState(page);
  check('R after busted is clean', reset.mission === 'active' && reset.wanted === 0 && reset.police === 0 && reset.bannerHidden, JSON.stringify(reset));

  // Escaped: steal, wedge the cruiser far away, let the star drop, then R.
  await teleportToNearestParkedCar(page);
  await page.keyboard.press('KeyE');
  await stepSim(0.5);
  await page.evaluate(() => {
    const g = window.__sunsetKeys;
    let biggest = g.colliders[0];
    for (const box of g.colliders) {
      const area = (box.maxX - box.minX) * (box.maxZ - box.minZ);
      const best = (biggest.maxX - biggest.minX) * (biggest.maxZ - biggest.minZ);
      if (area > best) biggest = box;
    }
    const p = g.police[0];
    p.x = (biggest.minX + biggest.maxX) / 2;
    p.z = (biggest.minZ + biggest.maxZ) / 2;
    p.speed = 0;
    p.mesh.position.set(p.x, 0, p.z);
    g.driving.x = p.x > 0 ? p.x - 120 : p.x + 120;
    g.driving.z = p.z > 0 ? p.z - 120 : p.z + 120;
  });
  await stepSim(11);
  const escaped = await chaseState(page);
  check('escaped before restart check', escaped.wanted === 0 && escaped.police === 0, JSON.stringify(escaped));
  await page.keyboard.press('KeyR');
  await stepSim(0.5);
  reset = await chaseState(page);
  check('R after escape is clean', reset.mission === 'active' && reset.wanted === 0 && reset.police === 0 && reset.bannerHidden, JSON.stringify(reset));

  // --- Combat: on foot, F shoves the pedestrian in front of the player. ---
  const punch = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    const ped = g.pedestrians[0];
    // Stand 1.5 m from the pedestrian, facing them.
    const dx = ped.x - g.player.state.x;
    const dz = ped.z - g.player.state.z;
    const d = Math.hypot(dx, dz);
    const nx = ped.x - (dx / d) * 1.5;
    const nz = ped.z - (dz / d) * 1.5;
    g.player.teleport(nx, nz, Math.atan2(dx, dz));
    const beforeX = ped.x;
    const beforeZ = ped.z;
    g.punch();
    g.step(0.5);
    const moved = Math.hypot(ped.x - beforeX, ped.z - beforeZ);
    return {
      moved: +moved.toFixed(2),
      fleeTimer: +ped.fleeTimer.toFixed(2),
      punchCooldown: +(g.player.state.punchCooldown ?? -1).toFixed(2),
      punchTimer: +(g.player.state.punchTimer ?? -1).toFixed(2),
    };
  });
  check('shove knocks the pedestrian back', punch.moved > 0.5, `moved ${punch.moved} m`);
  check('shoved pedestrian flees', punch.fleeTimer > 0, `flee ${punch.fleeTimer} s`);
  check('shove starts its cooldown', punch.punchCooldown > 0, `cooldown ${punch.punchCooldown} s`);
  // A second shove inside the cooldown does nothing: the timer is untouched.
  const punch2 = await page.evaluate(() => {
    const g = window.__sunsetKeys;
    const before = g.player.state.punchTimer;
    g.punch();
    return { before: +before.toFixed(2), after: +g.player.state.punchTimer.toFixed(2) };
  });
  check('shove respects its cooldown', punch2.after === punch2.before, JSON.stringify(punch2));

  check('cp3 zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function main() {
  const modes = process.argv.slice(2);
  if (modes.length === 0) modes.push('shots');
  if (modes.includes('all')) modes.push('shots', 'playtest', 'cp3');
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'ignore' });
  const up = await waitForServer();
  if (!up) {
    console.log('server did not start');
    server.kill();
    process.exit(1);
  }
  console.log('server up on', BASE);
  // Play-test captures go under playtest/ (gitignored) so the repo root
  // never collects stray screenshots from a test run again.
  mkdirSync(join(REPO, 'playtest'), { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  try {
    if (modes.includes('shots')) await takeShots(browser);
    if (modes.includes('playtest')) await playtest(browser);
    if (modes.includes('cp3')) await cp3test(browser);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures === 0 ? 'done — all checks passed' : `done — ${failures} check(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
