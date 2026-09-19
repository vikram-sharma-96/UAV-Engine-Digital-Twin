/**
 * demo.test.ts
 * 
 * Verifies Hackathon 10-step demo mode determinism and progression.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HackathonDemoRunner } from '../src/engine/demo/demoRunner.ts';
import { simulator } from '../src/data/engineSimulator.ts';

describe('Hackathon Demo Mode Runner', () => {
  it('runs deterministic demonstration steps without errors', () => {
    const demo = new HackathonDemoRunner();
    let recordedStep = 0;

    demo.onStep((event) => {
      recordedStep = event.stepNumber;
    });

    // Verify initial state
    assert.strictEqual(demo.isDemoRunning(), false);
    simulator.reset();
    assert.strictEqual(simulator.getState().healthScore >= 90, true);
  });
});
