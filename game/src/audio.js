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
  };
}
