import type { GameConfig } from "./config.js";
import { DEFAULT_CONFIG, secondsToTicks, validateGameConfig } from "./config.js";
import { PLAYER_IDS } from "./types.js";
import type { BodyState, MatchState, PlayerState } from "./types.js";

function body(x: number, y: number): BodyState {
  return { position: { x, y }, velocity: { x: 0, y: 0 } };
}

export function createMatch(config: GameConfig = DEFAULT_CONFIG): MatchState {
  validateGameConfig(config);
  const y = config.arena.height / 2;
  return {
    tick: 0,
    phase: "waiting",
    period: "regulation",
    phaseTicksRemaining: 0,
    regulationTicksRemaining: secondsToTicks(config.rules.regulationSeconds),
    round: 0,
    ready: { p1: false, p2: false },
    players: {
      p1: { ...body(config.arena.width * 0.2, y), pulseCooldownTicks: 0 },
      p2: { ...body(config.arena.width * 0.8, y), pulseCooldownTicks: 0 },
    },
    ball: body(config.arena.width / 2, y),
    score: { p1: 0, p2: 0 },
    winner: null,
    finishReason: null,
  };
}

export function resetPositions(state: MatchState, config: GameConfig): void {
  const y = config.arena.height / 2;
  for (const id of PLAYER_IDS) {
    state.players[id].position = { x: config.arena.width * (id === "p1" ? 0.2 : 0.8), y };
    state.players[id].velocity = { x: 0, y: 0 };
    state.players[id].pulseCooldownTicks = 0;
  }
  state.ball.position = { x: config.arena.width / 2, y };
  state.ball.velocity = { x: 0, y: 0 };
}

function cloneBody(value: BodyState): BodyState {
  return { position: { ...value.position }, velocity: { ...value.velocity } };
}

/** Detached transport/prediction checkpoint; changes cannot mutate the authoritative state. */
export function cloneMatch(state: MatchState): MatchState {
  const clonePlayer = (value: PlayerState): PlayerState => ({ ...cloneBody(value), pulseCooldownTicks: value.pulseCooldownTicks });
  return {
    ...state,
    ready: { ...state.ready },
    score: { ...state.score },
    players: { p1: clonePlayer(state.players.p1), p2: clonePlayer(state.players.p2) },
    ball: cloneBody(state.ball),
  };
}

function counter(value: number, name: string, maximum = Number.MAX_SAFE_INTEGER - 1): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new RangeError(`Invalid ${name}`);
}

/** Fail before stepping corrupted authority state. Do not silently invent replacement scores/positions. */
export function assertMatchState(state: MatchState, config: GameConfig = DEFAULT_CONFIG): void {
  counter(state.tick, "tick");
  counter(state.round, "round");
  counter(state.phaseTicksRemaining, "phase ticks", Math.max(secondsToTicks(config.rules.countdownSeconds), secondsToTicks(config.rules.goalCelebrationSeconds)));
  counter(state.regulationTicksRemaining, "regulation ticks", secondsToTicks(config.rules.regulationSeconds));
  if (!["waiting", "countdown", "playing", "goal-celebration", "finished"].includes(state.phase)) throw new RangeError("Invalid phase");
  if (state.period !== "regulation" && state.period !== "overtime") throw new RangeError("Invalid period");
  if (state.period === "overtime" && state.regulationTicksRemaining !== 0) throw new RangeError("Overtime cannot retain regulation time");
  if (state.phase === "finished") {
    if (state.winner !== "p1" && state.winner !== "p2") throw new RangeError("Finished match needs a winner");
    if (state.finishReason !== "score-limit" && state.finishReason !== "regulation" && state.finishReason !== "overtime") throw new RangeError("Finished match needs a reason");
  } else if (state.winner !== null || state.finishReason !== null) {
    throw new RangeError("Unfinished match cannot have a winner");
  }
  for (const id of PLAYER_IDS) {
    counter(state.score[id], "score", config.rules.scoreToWin);
    counter(state.players[id].pulseCooldownTicks, "cooldown", secondsToTicks(config.pulse.cooldownSeconds));
    if (typeof state.ready[id] !== "boolean") throw new RangeError("Invalid readiness");
  }
  for (const value of [state.players.p1, state.players.p2, state.ball]) {
    if (![value.position.x, value.position.y, value.velocity.x, value.velocity.y].every(Number.isFinite)) {
      throw new RangeError("Physics state must remain finite");
    }
    const margin = 2 * Math.max(config.ball.radius, config.player.radius) + 1;
    if (value.position.x < -margin || value.position.x > config.arena.width + margin || value.position.y < -margin || value.position.y > config.arena.height + margin) {
      throw new RangeError("Physics position is outside the supported arena bounds");
    }
  }
}
