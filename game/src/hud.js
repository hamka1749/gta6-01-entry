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
  const saveToastEl = document.getElementById('save-toast');
  const startEl = document.getElementById('start-screen');
  const playButton = document.getElementById('play-button');
  const continueButton = document.getElementById('continue-button');

  let onPlay = null;
  let onContinue = null;
  let saveToastTimer = 0;
  playButton.addEventListener('click', () => {
    if (onPlay) onPlay();
  });
  continueButton.addEventListener('click', () => {
    if (onContinue) onContinue();
  });

  return {
    /**
     * Show the title screen; `onPlay` runs on PLAY, `onContinue` on
     * CONTINUE, which is only offered when a save exists to pick up.
     */
    showStart(onPlayCallback, onContinueCallback, hasSave) {
      onPlay = onPlayCallback;
      onContinue = onContinueCallback;
      continueButton.classList.toggle('hidden', !hasSave);
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
      const level = Math.max(0, Math.min(3, stars));
      wantedEl.textContent = level > 0 ? '★'.repeat(level) + '☆'.repeat(3 - level) : '';
      wantedEl.classList.toggle('hidden', level === 0);
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
      bannerEl.textContent = '';
    },
    /** A short-lived "Progress saved" note; autosaves stay silent. */
    showSaveToast(text) {
      saveToastEl.textContent = text;
      saveToastEl.classList.remove('hidden');
      window.clearTimeout(saveToastTimer);
      saveToastTimer = window.setTimeout(() => saveToastEl.classList.add('hidden'), 1800);
    },
    hideSaveToast() {
      window.clearTimeout(saveToastTimer);
      saveToastEl.classList.add('hidden');
    },
  };
}
