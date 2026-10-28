import { DEFAULT_CONFIG, FIXED_DT, secondsToTicks, validateGameConfig } from "./config.js";
import type { GameConfig } from "./config.js";
import { normalizeInput } from "./math.js";
import { applyPlayerMovement } from "./movement.js";
import { clampSpeeds, integratePhysics } from "./physics.js";
import { applyPulses } from "./pulse.js";
import { assertMatchState, resetPositions } from "./state.js";
import { NEUTRAL_INPUTS, PLAYER_IDS } from "./types.js";
import type { FinishReason, GameEvent, MatchInputs, MatchState, PlayerId } from "./types.js";

export function setPlayerReady(state: MatchState, playerId: PlayerId, ready: boolean, config: GameConfig = DEFAULT_CONFIG): GameEvent[] {
  validateGameConfig(config);
  assertMatchState(state, config);
  if ((playerId !== "p1" && playerId !== "p2") || typeof ready !== "boolean") throw new TypeError("Invalid ready command");
  if (state.phase !== "waiting" && state.phase !== "countdown") return [];
  state.ready[playerId] = ready;
  if (state.ready.p1 && state.ready.p2 && state.phase === "waiting") {
    state.phase = "countdown";
    state.phaseTicksRemaining = secondsToTicks(config.rules.countdownSeconds);
    return [{ type: "countdown-started", tick: state.tick }];
  }
  if ((!state.ready.p1 || !state.ready.p2) && state.phase === "countdown") {
    state.phase = "waiting";
    state.phaseTicksRemaining = 0;
    return [{ type: "countdown-cancelled", tick: state.tick }];
  }
  return [];
}

function freezeBodies(state: MatchState): void {
  for (const body of [state.players.p1, state.players.p2, state.ball]) body.velocity = { x: 0, y: 0 };
}

function finish(state: MatchState, winner: PlayerId, reason: FinishReason, events: GameEvent[]): void {
  state.phase = "finished";
  state.phaseTicksRemaining = 0;
  state.winner = winner;
  state.finishReason = reason;
  freezeBodies(state);
  events.push({ type: "match-ended", tick: state.tick, winner, reason });
}

/** One fixed 1/60-second step. No clocks, sockets, rendering, or client-supplied dt. */
export function stepMatch(state: MatchState, inputs: MatchInputs = NEUTRAL_INPUTS, config: GameConfig = DEFAULT_CONFIG): GameEvent[] {
  validateGameConfig(config);
  assertMatchState(state, config);
  if (state.phase === "waiting" || state.phase === "finished") return [];
  const events: GameEvent[] = [];
  state.tick++;
  if (state.phase === "countdown" || state.phase === "goal-celebration") {
    state.phaseTicksRemaining--;
    if (state.phaseTicksRemaining <= 0) {
      resetPositions(state, config);
      state.phase = "playing";
      state.phaseTicksRemaining = 0;
      state.round++;
      events.push({ type: "kickoff", tick: state.tick, round: state.round });
    }
    return events;
  }

  const normalized: MatchInputs = { p1: normalizeInput(inputs.p1), p2: normalizeInput(inputs.p2) };
  clampSpeeds(state, config);
  for (const id of PLAYER_IDS) {
    state.players[id].pulseCooldownTicks = Math.max(0, state.players[id].pulseCooldownTicks - 1);
    applyPlayerMovement(state.players[id], normalized[id], config);
  }
  const damping = Math.exp(-config.ball.damping * FIXED_DT);
  state.ball.velocity.x *= damping;
  state.ball.velocity.y *= damping;
  for (const playerId of applyPulses(state, normalized, config)) events.push({ type: "pulse", tick: state.tick, playerId });
  const goal = integratePhysics(state, config);
  if (state.period === "regulation") state.regulationTicksRemaining = Math.max(0, state.regulationTicksRemaining - 1);
  if (goal !== null) {
    state.score[goal.scorer]++;
    events.push({ type: "goal", tick: state.tick, ...goal });
    if (state.score[goal.scorer] >= config.rules.scoreToWin) {
      finish(state, goal.scorer, "score-limit", events);
    } else if (state.period === "overtime") {
      finish(state, goal.scorer, "overtime", events);
    }
  }

  // Resolve this tick's crossing BEFORE expiry: a buzzer goal can tie or win regulation.
  if (state.winner === null && state.period === "regulation" && state.regulationTicksRemaining === 0) {
    if (state.score.p1 !== state.score.p2) {
      finish(state, state.score.p1 > state.score.p2 ? "p1" : "p2", "regulation", events);
    } else {
      state.period = "overtime";
      events.push({ type: "overtime-started", tick: state.tick });
    }
  }
  if (goal !== null && state.winner === null) {
    state.phase = "goal-celebration";
    state.phaseTicksRemaining = secondsToTicks(config.rules.goalCelebrationSeconds);
    freezeBodies(state);
  }
  assertMatchState(state, config);
  return events;
}
