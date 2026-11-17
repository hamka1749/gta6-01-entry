// SUNSET KEYS — the HUD: objective, speed, prompts and the start screen.
// Plain DOM over the 3D canvas: fast to update, readable at a glance, and
// the screenshot poses read the same elements a player sees.

import { CITY_NAME, GAME_TITLE } from './config.js';

export function createHud() {
  const root = document.getElementById('hud');
  const objectiveEl = document.getElementById('objective');
  const wantedEl = document.getElementById('wanted');
  const speedEl = document.getElementById('speed-value');
  const speedLabelEl = document.getElementById('speed-label');
  const promptEl = document.getElementById('prompt');
  const bannerEl = document.getElementById('banner');
  const startEl = document.getElementById('start-screen');
  const playButton = document.getElementById('play-button');

  let onPlay = null;
  playButton.addEventListener('click', () => {
    if (onPlay) onPlay();
  });

  return {
    /** Show the title screen; `onPlay` runs when the player clicks Play. */
    showStart(onPlayCallback) {
      onPlay = onPlayCallback;
      startEl.classList.remove('hidden');
      document.getElementById('start-title').textContent = GAME_TITLE;
      document.getElementById('start-city').textContent = `Welcome to ${CITY_NAME}`;
    },
    hideStart() {
      startEl.classList.add('hidden');
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    /** Wanted stars: filled ★ for the level, empty ☆ up to three. Hidden at zero. */
    setWanted(stars) {
      wantedEl.textContent = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
      wantedEl.classList.toggle('hidden', stars === 0);
    },
    /** Speed in km/h; while on foot the label reads ON FOOT. */
    setSpeed(kmh, driving) {
      speedEl.textContent = driving ? String(Math.round(kmh)) : '—';
      speedLabelEl.textContent = driving ? 'km/h' : 'ON FOOT';
    },
    showPrompt(text) {
      promptEl.textContent = text;
      promptEl.classList.remove('hidden');
    },
    hidePrompt() {
      promptEl.classList.add('hidden');
    },
    showBanner(text) {
      bannerEl.textContent = text;
      bannerEl.classList.remove('hidden');
      bannerEl.classList.remove('fail');
    },
    /** The same banner in red, for the busted (mission failed) state. */
    showFailBanner(text) {
      bannerEl.textContent = text;
      bannerEl.classList.remove('hidden');
      bannerEl.classList.add('fail');
    },
    hideBanner() {
      bannerEl.classList.add('hidden');
      bannerEl.classList.remove('fail');
    },
  };
}
