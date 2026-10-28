import type { GameConfig } from "./config.js";
import { secondsToTicks } from "./config.js";
import { EPSILON, limitVector } from "./math.js";
import { opponentOf, PLAYER_IDS } from "./types.js";
import type { MatchInputs, MatchState, PlayerId, Vector2 } from "./types.js";

export function pulseFalloff(distance: number, radius: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0 || distance < 0 || distance >= radius) return 0;
  const remaining = 1 - distance / radius;
  return remaining * remaining;
}

/** Accumulate every pulse against the same positions before applying any velocity changes. */
export function applyPulses(state: MatchState, inputs: MatchInputs, config: GameConfig): PlayerId[] {
  const delta: Record<PlayerId | "ball", Vector2> = {
    p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, ball: { x: 0, y: 0 },
  };
  const emitted: PlayerId[] = [];
  for (const id of PLAYER_IDS) {
    const player = state.players[id];
    if (!inputs[id].pulsePressed || player.pulseCooldownTicks > 0) continue;
    emitted.push(id);
    player.pulseCooldownTicks = secondsToTicks(config.pulse.cooldownSeconds);
    const recoil = { x: 0, y: 0 };
    const opponent = opponentOf(id);
    const targets = [
      { id: "ball" as const, body: state.ball, mass: config.ball.mass, impulse: config.pulse.ballImpulse },
      { id: opponent, body: state.players[opponent], mass: config.player.mass, impulse: config.pulse.opponentImpulse },
    ];
    for (const target of targets) {
      const dx = target.body.position.x - player.position.x;
      const dy = target.body.position.y - player.position.y;
      const distance = Math.hypot(dx, dy);
      const strength = target.impulse * pulseFalloff(distance, config.pulse.radius);
      // No aim input exists: exact overlap uses the player's attacking direction.
      const nx = distance > EPSILON ? dx / distance : id === "p1" ? 1 : -1;
      const ny = distance > EPSILON ? dy / distance : 0;
      delta[target.id].x += nx * strength / target.mass;
      delta[target.id].y += ny * strength / target.mass;
      recoil.x -= nx * strength * config.pulse.recoilFactor / config.player.mass;
      recoil.y -= ny * strength * config.pulse.recoilFactor / config.player.mass;
    }
    limitVector(recoil, config.pulse.maxRecoilSpeed);
    delta[id].x += recoil.x;
    delta[id].y += recoil.y;
  }
  for (const id of PLAYER_IDS) {
    state.players[id].velocity.x += delta[id].x;
    state.players[id].velocity.y += delta[id].y;
    limitVector(state.players[id].velocity, config.player.maxSpeed);
  }
  state.ball.velocity.x += delta.ball.x;
  state.ball.velocity.y += delta.ball.y;
  limitVector(state.ball.velocity, config.ball.maxSpeed);
  return emitted;
}
