/**
 * prng.ts
 * 
 * Deterministic Pseudo-Random Number Generator (PRNG) using Mulberry32
 * with Box-Muller Gaussian transform.
 * 
 * Ensures that given the same random seed, the entire simulation trajectory,
 * sensor noise, and stochastic events are 100% reproducible.
 */

export class PRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  /** Reset or change seed */
  reseed(seed: number): void {
    this.state = seed >>> 0;
  }

  /** Uniform random float in [0, 1) */
  random(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform random float between min and max */
  uniform(min: number, max: number): number {
    return min + (max - min) * this.random();
  }

  /** Gaussian-distributed random number with mean and standard deviation */
  gaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.random();
    let u2 = this.random();
    // Guard against log(0)
    while (u1 <= 1e-15) {
      u1 = this.random();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}
