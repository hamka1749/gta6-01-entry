// SUNSET KEYS — sound, synthesised live with WebAudio, no audio files.
// A low engine hum whose pitch follows the car's speed, a soft blip when
// entering or leaving a car, and a two-note chime when the objective
// completes. Everything starts on the first user gesture, as browsers
// require; a game with no audio permission still plays silently.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  // The police siren: one square oscillator whose pitch alternates on the
  // simulation clock the loop passes in, so the sound never needs its own
  // timer. Silent until the wanted level is above zero.
  let sirenOsc = null;
  let sirenGain = null;

  function ensureContext() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 42;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(context.destination);
      engineOsc.start();
    } catch {
      context = null;
    }
    return context;
  }

  function blip(frequency, duration, type = 'sine', volume = 0.12) {
    if (!ensureContext()) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call from the Play click: unlocks audio and starts the engine hum. */
    unlock() {
      ensureContext();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Engine hum follows the car's speed (0 while on foot or stopped). */
    setEngine(speedFraction) {
      if (!engineGain || !engineOsc) return;
      try {
        engineOsc.frequency.setTargetAtTime(42 + speedFraction * 130, context.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(speedFraction > 0.02 ? 0.05 + speedFraction * 0.05 : 0, context.currentTime, 0.1);
      } catch {
        // Ignore audio errors.
      }
    },
    enterCar() {
      blip(520, 0.12, 'sine', 0.14);
      setTimeout(() => blip(780, 0.14, 'sine', 0.14), 90);
    },
    exitCar() {
      blip(420, 0.1, 'sine', 0.12);
    },
    objectiveDone() {
      blip(660, 0.18, 'triangle', 0.16);
      setTimeout(() => blip(990, 0.3, 'triangle', 0.16), 160);
    },
    /** Two short horn toots (H key). */
    honk() {
      blip(370, 0.12, 'square', 0.08);
      setTimeout(() => blip(370, 0.14, 'square', 0.08), 140);
    },
    /** Rising sting when another wanted star appears. */
    wantedUp() {
      blip(440, 0.12, 'square', 0.1);
      setTimeout(() => blip(587, 0.18, 'square', 0.1), 120);
    },
    /** The thud of a police cruiser ramming the player's car. */
    thud() {
      blip(90, 0.18, 'sine', 0.22);
    },
    /** Descending sting when the cops finally hold the player. */
    busted() {
      blip(392, 0.2, 'triangle', 0.16);
      setTimeout(() => blip(311, 0.2, 'triangle', 0.16), 180);
      setTimeout(() => blip(233, 0.35, 'triangle', 0.16), 360);
    },
    /**
     * Police siren, driven by the loop: `on` while wanted, `distance` to
     * the nearest cruiser (closer is louder), `simTime` for the two-tone
     * alternation. A game with no audio permission still plays silently.
     */
    setSiren(on, distance, simTime) {
      if (!on) {
        if (sirenGain) sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        return;
      }
      if (!ensureContext()) return;
      try {
        if (!sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'square';
          sirenOsc.frequency.value = 700;
          sirenGain = context.createGain();
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain).connect(context.destination);
          sirenOsc.start();
        }
        const tone = Math.floor(simTime / 0.35) % 2 === 0 ? 700 : 950;
        sirenOsc.frequency.setTargetAtTime(tone, context.currentTime, 0.05);
        const loudness = Math.max(0, 0.06 - Math.max(0, distance - 10) * 0.001);
        sirenGain.gain.setTargetAtTime(loudness, context.currentTime, 0.2);
      } catch {
        // Sound is garnish: never let it break the game.
      }
    },
  };
}
