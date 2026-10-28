import { MAX_CLIENT_MESSAGE_BYTES, PROTOCOL_VERSION } from "./messages.js";
import type { ClientMessage } from "./messages.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keys(value: RecordValue, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function sequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Structural validation only: the room must authenticate, deduplicate, and rate-limit. */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (!record(value) || value['protocolVersion'] !== PROTOCOL_VERSION) return false;
  const base = ["type", "protocolVersion"];
  if (value['type'] === "hello") {
    return keys(value, [...base, "roomId", "guestSessionId", "reconnectCredential"])
      && identifier(value['roomId']) && identifier(value['guestSessionId'])
      && typeof value['reconnectCredential'] === "string" && /^[A-Za-z0-9_-]{22,256}$/.test(value['reconnectCredential']);
  }
  if (value['type'] === "ping") return keys(value, [...base, "nonce"]) && sequence(value['nonce']);
  if (!sequence(value['connectionEpoch'])) return false;
  const connected = [...base, "connectionEpoch"];
  switch (value['type']) {
    case "input":
      return keys(value, [...connected, "matchId", "seq", "moveX", "moveY", "pulseActionId"])
        && identifier(value['matchId']) && sequence(value['seq'])
        && typeof value['moveX'] === "number" && Number.isFinite(value['moveX']) && Math.abs(value['moveX']) <= 1
        && typeof value['moveY'] === "number" && Number.isFinite(value['moveY']) && Math.abs(value['moveY']) <= 1
        && (value['pulseActionId'] === null || sequence(value['pulseActionId']));
    case "ready":
      return keys(value, [...connected, "ready"]) && typeof value['ready'] === "boolean";
    case "rematch":
      return keys(value, [...connected, "matchId", "accept"]) && identifier(value['matchId']) && typeof value['accept'] === "boolean";
    case "leave":
      return keys(value, connected);
    default:
      return false;
  }
}

export function decodeClientMessage(json: string): ClientMessage | null {
  if (json.length > MAX_CLIENT_MESSAGE_BYTES) return null;
  let bytes = 0;
  for (const character of json) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_CLIENT_MESSAGE_BYTES) return null;
  }
  // The transport must also limit bytes before decoding or allocating the string.
  try {
    const value: unknown = JSON.parse(json);
    return isClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}
