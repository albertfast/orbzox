export { MAX_CLIENT_MESSAGE_BYTES, NETWORK_TARGETS, PROTOCOL_VERSION } from "./messages.js";
export type { ClientMessage, CreateRoomRequest, HelloMessage, InputMessage, JoinRoomRequest, LobbySeat, ProtocolErrorCode, SeatGrant, ServerMessage, SnapshotMessage } from "./messages.js";
export { decodeClientMessage, isClientMessage } from "./validation.js";
