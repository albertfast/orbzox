import { describe, expect, it } from "vitest";
import { createGameConfig, resolveCircleCollision, resolveRectangleWalls, stepMatch } from "@orvli/game-core";
import type { BodyState } from "@orvli/game-core";
import { advance, FAST_CONFIG, inputs, playing } from "../helpers.js";

const body = (x: number, vx: number, y = 0, vy = 0): BodyState => ({ position: { x, y }, velocity: { x: vx, y: vy } });
const material = { radius: 0.5, mass: 1 };

describe("circle contacts", () => {
  it("exchanges head-on velocities for equal elastic masses", () => {
    const a = body(0, 2);
    const b = body(0.9, -1);
    expect(resolveCircleCollision(a, material, b, material, 1)).toBe(true);
    expect(a.velocity.x).toBeCloseTo(-1);
    expect(b.velocity.x).toBeCloseTo(2);
    expect(b.position.x - a.position.x).toBeGreaterThanOrEqual(1);
  });

  it("preserves momentum and kinetic energy with unequal elastic masses", () => {
    const a = body(0, 2);
    const b = body(0.9, 0);
    resolveCircleCollision(a, { radius: 0.5, mass: 3 }, b, material, 1);
    expect(3 * a.velocity.x + b.velocity.x).toBeCloseTo(6);
    expect(0.5 * (3 * a.velocity.x ** 2 + b.velocity.x ** 2)).toBeCloseTo(6);
  });

  it("does not bounce separating overlaps or unrelated bodies", () => {
    const a = body(0, -1);
    const b = body(0.9, 1);
    resolveCircleCollision(a, material, b, material, 0.9);
    expect(a.velocity.x).toBe(-1);
    expect(b.velocity.x).toBe(1);
    expect(resolveCircleCollision(a, material, body(10, 0), material, 1)).toBe(false);
  });

  it("resolves exact coincidence without a divide by zero", () => {
    const a = body(0, 0);
    const b = body(0, 0);
    resolveCircleCollision(a, material, b, material, 1);
    expect(Number.isFinite(a.position.x)).toBe(true);
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThanOrEqual(1);
  });

  it("handles glancing impacts without adding energy", () => {
    const a = body(0, 3, 0, 1);
    const b = body(0.7, -1, 0.6, 0);
    const energy = a.velocity.x ** 2 + a.velocity.y ** 2 + b.velocity.x ** 2;
    resolveCircleCollision(a, material, b, material, 0.8);
    expect(a.velocity.x ** 2 + a.velocity.y ** 2 + b.velocity.x ** 2 + b.velocity.y ** 2).toBeLessThanOrEqual(energy);
  });
});

describe("arena contacts", () => {
  it.each([
    { x: 0.1, y: 4, vx: -3, vy: 0, expected: [1.5, 0] },
    { x: 15.9, y: 4, vx: 3, vy: 0, expected: [-1.5, 0] },
    { x: 8, y: 0.1, vx: 0, vy: -3, expected: [0, 1.5] },
    { x: 8, y: 8.9, vx: 0, vy: 3, expected: [0, -1.5] },
  ])("reflects only the approaching wall component: $x,$y", ({ x, y, vx, vy, expected }) => {
    const value = body(x, vx, y, vy);
    resolveRectangleWalls(value, 0.35, 16, 9, 0.5);
    expect([value.velocity.x, value.velocity.y]).toEqual(expected);
    expect(value.position.x).toBeGreaterThanOrEqual(0.35);
    expect(value.position.x).toBeLessThanOrEqual(15.65);
  });

  it("handles a corner and does not reverse a body already moving inward", () => {
    const value = body(0, -2, 0, -3);
    resolveRectangleWalls(value, 0.35, 16, 9, 1);
    expect(value.velocity).toEqual({ x: 2, y: 3 });
    value.position.x = 0;
    resolveRectangleWalls(value, 0.35, 16, 9, 1);
    expect(value.velocity.x).toBe(2);
  });

  it("keeps players inside even at the goal opening", () => {
    const state = playing();
    state.players.p1.position.x = FAST_CONFIG.player.radius;
    advance(state, 180, inputs({ moveX: -1 }));
    expect(state.players.p1.position.x).toBeGreaterThanOrEqual(FAST_CONFIG.player.radius);
    expect(state.score).toEqual({ p1: 0, p2: 0 });
  });

  it("bounces the ball off a side wall outside the goal mouth", () => {
    const state = playing();
    state.ball.position = { x: 0.3, y: 1 };
    state.ball.velocity = { x: -18, y: 0 };
    stepMatch(state, inputs(), FAST_CONFIG);
    expect(state.ball.velocity.x).toBeGreaterThan(0);
    expect(state.ball.position.x).toBeGreaterThanOrEqual(FAST_CONFIG.ball.radius);
    expect(state.score).toEqual({ p1: 0, p2: 0 });
  });

  it("collides with the rounded goalpost instead of awarding an edge goal", () => {
    const state = playing();
    state.ball.position = { x: 0.7, y: 3.05 };
    state.ball.velocity = { x: -18, y: 0 };
    advance(state, 3);
    expect(state.ball.velocity.x).toBeGreaterThan(0);
    expect(state.score).toEqual({ p1: 0, p2: 0 });
  });

  it("does not tunnel through a player at a supported 100-unit ball speed", () => {
    const config = createGameConfig({ ball: { maxSpeed: 100, damping: 0 } });
    const state = playing(config);
    state.players.p1.position = { x: 6, y: 4.5 };
    state.ball.position = { x: 5, y: 4.5 };
    state.ball.velocity.x = 100;
    stepMatch(state, inputs(), config);
    expect(state.ball.position.x).toBeLessThan(state.players.p1.position.x);
    expect(state.ball.velocity.x).toBeLessThan(0);
    expect(state.players.p1.velocity.x).toBeGreaterThan(0);
    expect(Math.hypot(state.players.p1.velocity.x, state.players.p1.velocity.y)).toBeLessThanOrEqual(config.player.maxSpeed + 1e-10);
  });

  it("handles a max-speed corner without escaping or increasing speed", () => {
    const config = createGameConfig({ ball: { maxSpeed: 100, damping: 0 } });
    const state = playing(config);
    state.ball.position = { x: 0.8, y: 0.8 };
    state.ball.velocity = { x: -100, y: -100 };
    stepMatch(state, inputs(), config);
    expect(state.ball.position.x).toBeGreaterThanOrEqual(config.ball.radius - 1e-8);
    expect(state.ball.position.y).toBeGreaterThanOrEqual(config.ball.radius - 1e-8);
    expect(Math.hypot(state.ball.velocity.x, state.ball.velocity.y)).toBeLessThanOrEqual(100);
  });

  it("damps the ball independently of player movement", () => {
    const state = playing();
    state.ball.position = { x: 8, y: 2 };
    state.ball.velocity.x = 1;
    advance(state, 60);
    expect(state.ball.velocity.x).toBeCloseTo(Math.exp(-FAST_CONFIG.ball.damping), 10);
  });
});
