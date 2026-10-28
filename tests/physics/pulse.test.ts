import { describe, expect, it } from "vitest";
import { assertMatchState, createGameConfig, createMatch, pulseFalloff, secondsToTicks, stepMatch } from "@orvli/game-core";
import { FAST_CONFIG, inputs, playing } from "../helpers.js";

function shotState() {
  const state = playing();
  state.players.p1.position = { x: 5, y: 4.5 };
  state.ball.position = { x: 6, y: 4.5 };
  return state;
}

describe("Gravity Pulse", () => {
  it("has bounded quadratic falloff, including radius and zero-distance boundaries", () => {
    expect(pulseFalloff(0, 2)).toBe(1);
    expect(pulseFalloff(1, 2)).toBe(0.25);
    expect(pulseFalloff(2, 2)).toBe(0);
    expect(pulseFalloff(3, 2)).toBe(0);
    expect(pulseFalloff(NaN, 2)).toBe(0);
    expect(pulseFalloff(0, 0)).toBe(0);
  });

  it("shoots the ball radially and recoils the emitter in the opposite direction", () => {
    const state = shotState();
    const events = stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    const impulse = FAST_CONFIG.pulse.ballImpulse * (1 - 1 / FAST_CONFIG.pulse.radius) ** 2;
    expect(events.filter((event) => event.type === "pulse")).toHaveLength(1);
    expect(state.ball.velocity.x).toBeCloseTo(impulse / FAST_CONFIG.ball.mass, 10);
    expect(state.players.p1.velocity.x).toBeCloseTo(-impulse * FAST_CONFIG.pulse.recoilFactor / FAST_CONFIG.player.mass, 10);
    expect(state.ball.velocity.y).toBe(0);
  });

  it("affects an opponent less strongly than a ball at the same distance", () => {
    const state = shotState();
    state.ball.position = { x: 8, y: 2 };
    state.players.p2.position = { x: 6, y: 4.5 };
    stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    const ballSpeed = FAST_CONFIG.pulse.ballImpulse * pulseFalloff(1, FAST_CONFIG.pulse.radius) / FAST_CONFIG.ball.mass;
    expect(state.players.p2.velocity.x).toBeGreaterThan(0);
    expect(state.players.p2.velocity.x).toBeLessThan(ballSpeed);
    expect(state.ball.velocity).toEqual({ x: 0, y: 0 });
  });

  it.each([2.4, 2.5])("does not affect a ball at/outside radius: %s", (distance) => {
    const state = shotState();
    state.ball.position.x = state.players.p1.position.x + distance;
    stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    expect(state.ball.velocity.x).toBe(0);
    expect(state.players.p1.pulseCooldownTicks).toBe(72);
  });

  it("consumes cooldown for a miss without inventing a recoil direction", () => {
    const state = playing();
    stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    expect(state.players.p1.pulseCooldownTicks).toBe(72);
    expect(state.players.p1.velocity).toEqual({ x: 0, y: 0 });
    expect(state.ball.velocity).toEqual({ x: 0, y: 0 });
  });

  it("rejects repeated attempts until exactly the cooldown boundary", () => {
    const state = playing();
    stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    for (let i = 1; i < secondsToTicks(FAST_CONFIG.pulse.cooldownSeconds); i++) {
      expect(stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG).some((event) => event.type === "pulse")).toBe(false);
    }
    expect(state.players.p1.pulseCooldownTicks).toBe(1);
    const events = stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    expect(events.filter((event) => event.type === "pulse")).toHaveLength(1);
    expect(state.players.p1.pulseCooldownTicks).toBe(72);
  });

  it("accumulates symmetric simultaneous pulses without player-order advantage", () => {
    const state = playing();
    state.players.p1.position = { x: 6.8, y: 4.5 };
    state.players.p2.position = { x: 9.2, y: 4.5 };
    const events = stepMatch(state, inputs({ pulsePressed: true }, { pulsePressed: true }), FAST_CONFIG);
    expect(events.filter((event) => event.type === "pulse")).toHaveLength(2);
    expect(state.ball.velocity.x).toBeCloseTo(0, 10);
    expect(state.players.p1.velocity.x).toBeCloseTo(-state.players.p2.velocity.x, 10);
    expect(state.players.p1.velocity.x).toBeLessThan(0);
  });

  it("caps recoil and ball speed under powerful tuning", () => {
    const config = createGameConfig({ pulse: { ballImpulse: 100, maxRecoilSpeed: 0.01 } });
    const state = playing(config);
    state.players.p1.position = { x: 5, y: 4.5 };
    state.ball.position = { x: 5.7, y: 4.5 };
    stepMatch(state, inputs({ pulsePressed: true }), config);
    expect(state.ball.velocity.x).toBeLessThanOrEqual(config.ball.maxSpeed);
    expect(state.players.p1.velocity.x).toBeCloseTo(-0.01, 12);
  });

  it("handles a pulse at exact coincidence without NaN", () => {
    const state = playing();
    state.ball.position = { ...state.players.p1.position };
    stepMatch(state, inputs({ pulsePressed: true }), FAST_CONFIG);
    expect(() => assertMatchState(state, FAST_CONFIG)).not.toThrow();
    expect(state.ball.velocity.x).toBeGreaterThan(0);
  });

  it("ignores actions before a match starts", () => {
    const state = createMatch();
    expect(stepMatch(state, inputs({ pulsePressed: true }))).toEqual([]);
    expect(state.players.p1.pulseCooldownTicks).toBe(0);
  });
});
