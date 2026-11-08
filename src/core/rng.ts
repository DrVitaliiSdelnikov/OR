export type RandomSource = () => number;

export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: RandomSource): number {
  const radiusSample = Math.max(random(), 1e-12);
  const angleSample = random();
  return Math.sqrt(-2 * Math.log(radiusSample)) * Math.cos(2 * Math.PI * angleSample);
}

