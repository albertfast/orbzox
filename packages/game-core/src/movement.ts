import { FIXED_DT } from "./config.js";
import type { GameConfig } from "./config.js";
import { limitVector, normalizeInput } from "./math.js";
import type { PlayerInput, PlayerState } from "./types.js";

/** Velocity-only step, shared with later client prediction. Position integration is separate. */
export function applyPlayerMovement(player: PlayerState, input: PlayerInput, config: GameConfig): void {
  const normalized = normalizeInput(input);
  limitVector(player.velocity, config.player.maxSpeed);
  const damping = Math.exp(-config.player.damping * FIXED_DT);
  player.velocity.x = (player.velocity.x + normalized.moveX * config.player.acceleration * FIXED_DT) * damping;
  player.velocity.y = (player.velocity.y + normalized.moveY * config.player.acceleration * FIXED_DT) * damping;
  limitVector(player.velocity, config.player.maxSpeed);
}
