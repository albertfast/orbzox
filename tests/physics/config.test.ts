import { describe, expect, it } from "vitest";
import { collisionSubsteps, createGameConfig, DEFAULT_CONFIG, FIXED_DT, secondsToTicks, SIMULATION_HZ } from "@orvli/game-core";

describe("simulation configuration", () => {
  it("preserves the approved world, rules, and fixed timestep", () => {
    expect(DEFAULT_CONFIG.arena).toEqual({ width: 16, height: 9, goalHeight: 3 });
    expect(DEFAULT_CONFIG.rules.regulationSeconds).toBe(75);
    expect(DEFAULT_CONFIG.rules.scoreToWin).toBe(5);
    expect(SIMULATION_HZ).toBe(60);
    expect(FIXED_DT).toBe(1 / 60);
    expect(secondsToTicks(75)).toBe(4500);
    expect(secondsToTicks(1.2)).toBe(72);
    expect(collisionSubsteps(DEFAULT_CONFIG)).toBeLessThanOrEqual(DEFAULT_CONFIG.physics.maxSubsteps);
  });

  it("freezes independent configuration groups without modifying defaults", () => {
    const tuned = createGameConfig({ ball: { maxSpeed: 25 } });
    expect(tuned.ball.maxSpeed).toBe(25);
    expect(DEFAULT_CONFIG.ball.maxSpeed).toBe(18);
    expect(Object.isFrozen(tuned)).toBe(true);
    expect(Object.isFrozen(tuned.ball)).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0])("rejects invalid radius %s", (radius) => {
    expect(() => createGameConfig({ ball: { radius } })).toThrow(RangeError);
  });

  it("rejects impossible geometry and an insufficient solver budget", () => {
    expect(() => createGameConfig({ arena: { goalHeight: 0.2 } })).toThrow(RangeError);
    expect(() => createGameConfig({ arena: { width: 4 }, player: { radius: 1 } })).toThrow(RangeError);
    expect(() => createGameConfig({ ball: { maxSpeed: 100 }, physics: { maxSubsteps: 2 } })).toThrow(/budget/);
    expect(() => createGameConfig({ physics: { collisionIterations: 1.5 } })).toThrow(RangeError);
    expect(() => createGameConfig({ rules: { scoreToWin: 2.5 } })).toThrow(RangeError);
    expect(() => createGameConfig({ ball: { wallRestitution: 1.1 } })).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity, 0.011])("rejects non-tick duration %s", (seconds) => {
    expect(() => secondsToTicks(seconds)).toThrow(RangeError);
  });
});
