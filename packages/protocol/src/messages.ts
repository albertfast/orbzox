import type { GameConfig, GameEvent, MatchState, PlayerId } from "@orvli/game-core";

export const PROTOCOL_VERSION = 1 as const;
export const NETWORK_TARGETS = Object.freeze({ simulationHz: 60, movementHz: 30, snapshotHz: 20 });
export const MAX_CLIENT_MESSAGE_BYTES = 2048;

interface Versioned {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
}

interface ConnectionCommand extends Versioned {
  readonly connectionEpoch: number;
}

export interface HelloMessage extends Versioned {
  readonly type: "hello";
  readonly roomId: string;
  readonly guestSessionId: string;
  readonly reconnectCredential: string;
}

export interface InputMessage extends ConnectionCommand {
  readonly type: "input";
  readonly matchId: string;
  readonly seq: number;
  readonly moveX: number;
  readonly moveY: number;
  /** A distinct action identifier, resent until acknowledged; null means no new edge. */
  readonly pulseActionId: number | null;
}

export type ClientMessage =
  | HelloMessage
  | InputMessage
  | (ConnectionCommand & { readonly type: "ready"; readonly ready: boolean })
  | (ConnectionCommand & { readonly type: "rematch"; readonly matchId: string; readonly accept: boolean })
  | (ConnectionCommand & { readonly type: "leave" })
  | (Versioned & { readonly type: "ping"; readonly nonce: number });

export interface SnapshotMessage extends Versioned {
  readonly type: "snapshot";
  readonly matchId: string;
  readonly connectionEpoch: number;
  readonly serverTick: number;
  readonly acknowledgedInputSeq: number;
  readonly acknowledgedPulseActionId: number | null;
  readonly state: MatchState;
}

export interface LobbySeat {
  readonly playerId: PlayerId;
  readonly nickname: string;
  readonly connected: boolean;
  readonly ready: boolean;
}

export type ProtocolErrorCode = "INVALID_MESSAGE" | "VERSION_MISMATCH" | "UNAUTHORIZED" | "ROOM_FULL" | "ROOM_EXPIRED" | "RATE_LIMITED" | "STALE_CONNECTION" | "STALE_MATCH";

export type ServerMessage =
  | SnapshotMessage
  | (Versioned & { readonly type: "welcome"; readonly playerId: PlayerId; readonly connectionEpoch: number; readonly matchId: string; readonly config: GameConfig })
  | (Versioned & { readonly type: "lobby"; readonly roomCode: string; readonly seats: readonly [LobbySeat | null, LobbySeat | null] })
  | (Versioned & { readonly type: "events"; readonly matchId: string; readonly eventId: number; readonly events: readonly GameEvent[] })
  | (Versioned & { readonly type: "connection-status"; readonly playerId: PlayerId; readonly connected: boolean; readonly graceRemainingMs: number })
  | (Versioned & { readonly type: "error"; readonly code: ProtocolErrorCode })
  | (Versioned & { readonly type: "pong"; readonly nonce: number });

export interface CreateRoomRequest { readonly nickname: string }
export type JoinRoomRequest = { readonly nickname: string } & (
  | { readonly roomCode: string }
  | { readonly invitationCapability: string }
);

/** Only a server can issue these values; a nickname never grants ownership. */
export interface SeatGrant {
  readonly guestSessionId: string;
  readonly roomId: string;
  readonly roomCode: string;
  readonly playerId: PlayerId;
  readonly reconnectCredential: string;
  readonly invitationCapability: string;
  readonly expiresAtEpochMs: number;
}
