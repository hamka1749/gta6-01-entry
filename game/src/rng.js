// SUNSET KEYS — deterministic randomness.
// Every random choice in the game comes from a seeded generator, so the
// same seed always builds the same island, the same traffic and the same
// screenshots. Nothing in the game uses Math.random or Date.now to decide
// content: those would make two runs of the entry differ.

// mulberry32: small, fast, well-behaved seeded PRNG.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with the seeded generator.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A number in [min, max) from the seeded generator.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] from the seeded generator.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
