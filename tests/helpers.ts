import { createGameConfig, createMatch, NEUTRAL_INPUT, NEUTRAL_INPUTS, secondsToTicks, setPlayerReady, stepMatch } from "@orvli/game-core";
import type { GameConfig, MatchInputs, MatchState, PlayerInput } from "@orvli/game-core";

export const FAST_CONFIG = createGameConfig({ rules: { countdownSeconds: 1 / 60, goalCelebrationSeconds: 2 / 60 } });

export function playing(config: GameConfig = FAST_CONFIG): MatchState {
  const state = createMatch(config);
  setPlayerReady(state, "p1", true, config);
  setPlayerReady(state, "p2", true, config);
  advance(state, secondsToTicks(config.rules.countdownSeconds), NEUTRAL_INPUTS, config);
  return state;
}

export function advance(state: MatchState, ticks: number, inputs: MatchInputs = NEUTRAL_INPUTS, config: GameConfig = FAST_CONFIG): void {
  for (let i = 0; i < ticks; i++) stepMatch(state, inputs, config);
}

export function inputs(p1: Partial<PlayerInput> = {}, p2: Partial<PlayerInput> = {}): MatchInputs {
  return { p1: { ...NEUTRAL_INPUT, ...p1 }, p2: { ...NEUTRAL_INPUT, ...p2 } };
}

export function arrangeGoal(state: MatchState, scorer: "p1" | "p2", config: GameConfig = FAST_CONFIG): void {
  state.ball.position = { x: scorer === "p1" ? config.arena.width + config.ball.radius - 0.03 : -config.ball.radius + 0.03, y: config.arena.height / 2 };
  state.ball.velocity = { x: scorer === "p1" ? 3 : -3, y: 0 };
}

export function seededRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (Math.imul(1664525, current) + 1013904223) >>> 0;
    return current / 0x1_0000_0000;
  };
}
