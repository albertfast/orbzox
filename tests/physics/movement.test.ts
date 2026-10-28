import { describe, expect, it } from "vitest";
import { applyPlayerMovement, createGameConfig, normalizeInput, stepMatch } from "@orvli/game-core";
import { advance, FAST_CONFIG, inputs, playing } from "../helpers.js";

describe("player movement", () => {
  it("accelerates immediately in the requested direction", () => {
    const state = playing();
    const initialX = state.players.p1.position.x;
    stepMatch(state, inputs({ moveX: 1 }), FAST_CONFIG);
    expect(state.players.p1.velocity.x).toBeGreaterThan(0);
    expect(state.players.p1.position.x).toBeGreaterThan(initialX);
  });

  it("diagonal input has no speed advantage", () => {
    const axis = playing().players.p1;
    const diagonal = playing().players.p1;
    for (let i = 0; i < 300; i++) {
      applyPlayerMovement(axis, inputs({ moveX: 1 }).p1, FAST_CONFIG);
      applyPlayerMovement(diagonal, inputs({ moveX: 1, moveY: 1 }).p1, FAST_CONFIG);
      expect(Math.hypot(axis.velocity.x, axis.velocity.y)).toBeLessThanOrEqual(FAST_CONFIG.player.maxSpeed + 1e-10);
    }
    expect(Math.hypot(diagonal.velocity.x, diagonal.velocity.y)).toBeCloseTo(Math.hypot(axis.velocity.x, axis.velocity.y), 12);
    expect(Math.hypot(axis.velocity.x, axis.velocity.y)).toBeCloseTo(FAST_CONFIG.player.maxSpeed);
  });

  it("damps momentum when input is released", () => {
    const state = playing();
    state.players.p1.velocity.x = 3;
    advance(state, 60);
    expect(state.players.p1.velocity.x).toBeGreaterThan(0);
    expect(state.players.p1.velocity.x).toBeCloseTo(3 * Math.exp(-FAST_CONFIG.player.damping), 10);
  });

  it("supports tuned acceleration and damping without changing tick length", () => {
    const config = createGameConfig({ player: { acceleration: 12, damping: 0 } });
    const state = playing(config);
    stepMatch(state, inputs({ moveX: 1 }), config);
    expect(state.players.p1.velocity.x).toBeCloseTo(12 / 60, 12);
  });

  it("neutralizes non-finite movement and clamps untrusted magnitudes", () => {
    expect(normalizeInput({ moveX: NaN, moveY: Infinity, pulsePressed: false })).toEqual({ moveX: 0, moveY: 0, pulsePressed: false });
    const normalized = normalizeInput({ moveX: 1e300, moveY: -1e300, pulsePressed: false });
    expect(Math.hypot(normalized.moveX, normalized.moveY)).toBeCloseTo(1);
    const state = playing();
    stepMatch(state, inputs({ moveX: NaN, moveY: -Infinity }), FAST_CONFIG);
    expect(state.players.p1.velocity).toEqual({ x: 0, y: 0 });
  });

  it("caps extreme but finite velocities before they can overflow calculations", () => {
    const state = playing();
    state.players.p1.velocity = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    state.ball.velocity = { x: -Number.MAX_VALUE, y: Number.MAX_VALUE };
    stepMatch(state, inputs(), FAST_CONFIG);
    expect(Math.hypot(state.players.p1.velocity.x, state.players.p1.velocity.y)).toBeLessThanOrEqual(FAST_CONFIG.player.maxSpeed + 1e-10);
    expect(Math.hypot(state.ball.velocity.x, state.ball.velocity.y)).toBeLessThanOrEqual(FAST_CONFIG.ball.maxSpeed + 1e-10);
  });
});
