export const PLAYER_IDS = ["p1", "p2"] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];
export type GoalSide = "left" | "right";

export interface Vector2 {
  x: number;
  y: number;
}

export interface BodyState {
  position: Vector2;
  velocity: Vector2;
}

export interface PlayerState extends BodyState {
  pulseCooldownTicks: number;
}

/** pulsePressed is an action edge, not a held-button state. */
export interface PlayerInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly pulsePressed: boolean;
}

export type MatchInputs = Readonly<Record<PlayerId, PlayerInput>>;
export type MatchPhase = "waiting" | "countdown" | "playing" | "goal-celebration" | "finished";
export type MatchPeriod = "regulation" | "overtime";
export type FinishReason = "score-limit" | "regulation" | "overtime";

/** Owned by the simulation caller. Never accept this object from a client. */
export interface MatchState {
  tick: number;
  phase: MatchPhase;
  period: MatchPeriod;
  phaseTicksRemaining: number;
  regulationTicksRemaining: number;
  round: number;
  ready: Record<PlayerId, boolean>;
  players: Record<PlayerId, PlayerState>;
  ball: BodyState;
  score: Record<PlayerId, number>;
  winner: PlayerId | null;
  finishReason: FinishReason | null;
}

export type GameEvent =
  | { readonly type: "countdown-started"; readonly tick: number }
  | { readonly type: "countdown-cancelled"; readonly tick: number }
  | { readonly type: "kickoff"; readonly tick: number; readonly round: number }
  | { readonly type: "pulse"; readonly tick: number; readonly playerId: PlayerId }
  | { readonly type: "goal"; readonly tick: number; readonly scorer: PlayerId; readonly side: GoalSide }
  | { readonly type: "overtime-started"; readonly tick: number }
  | { readonly type: "match-ended"; readonly tick: number; readonly winner: PlayerId; readonly reason: FinishReason };

export const NEUTRAL_INPUT: PlayerInput = Object.freeze({ moveX: 0, moveY: 0, pulsePressed: false });
export const NEUTRAL_INPUTS: MatchInputs = Object.freeze({ p1: NEUTRAL_INPUT, p2: NEUTRAL_INPUT });

export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "p1" ? "p2" : "p1";
}
