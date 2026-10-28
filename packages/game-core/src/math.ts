import type { PlayerInput, Vector2 } from "./types.js";

export const EPSILON = 1e-9;

/** Scaling before hypot also handles finite components whose joint length overflows. */
export function limitVector(vector: Vector2, maximum: number): void {
  const scale = Math.max(Math.abs(vector.x), Math.abs(vector.y));
  if (scale === 0) return;
  const nx = vector.x / scale;
  const ny = vector.y / scale;
  const length = Math.hypot(nx, ny);
  if (scale > maximum / length) {
    vector.x = nx / length * maximum;
    vector.y = ny / length * maximum;
  }
}

export function normalizeInput(input: PlayerInput): PlayerInput {
  const move = {
    x: Number.isFinite(input.moveX) ? Math.max(-1, Math.min(1, input.moveX)) : 0,
    y: Number.isFinite(input.moveY) ? Math.max(-1, Math.min(1, input.moveY)) : 0,
  };
  limitVector(move, 1);
  return { moveX: move.x, moveY: move.y, pulsePressed: input.pulsePressed === true };
}
