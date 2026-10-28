import type { GameConfig } from "./config.js";
import { EPSILON } from "./math.js";
import type { GoalSide, PlayerId, Vector2 } from "./types.js";

export interface GoalCrossing {
  readonly side: GoalSide;
  readonly scorer: PlayerId;
}

export function goalOpening(config: GameConfig): { top: number; bottom: number } {
  return {
    top: (config.arena.height - config.arena.goalHeight) / 2,
    bottom: (config.arena.height + config.arena.goalHeight) / 2,
  };
}

/** Swept whole-ball crossing. Merely touching, or already being behind, the plane is not a goal. */
export function detectGoalCrossing(previous: Vector2, next: Vector2, config: GameConfig): GoalCrossing | null {
  const radius = config.ball.radius;
  const leftPlane = -radius;
  const rightPlane = config.arena.width + radius;
  let side: GoalSide;
  let plane: number;
  if (previous.x > leftPlane && next.x <= leftPlane) {
    side = "left";
    plane = leftPlane;
  } else if (previous.x < rightPlane && next.x >= rightPlane) {
    side = "right";
    plane = rightPlane;
  } else {
    return null;
  }
  const t = (plane - previous.x) / (next.x - previous.x);
  const crossingY = previous.y + (next.y - previous.y) * t;
  const opening = goalOpening(config);
  if (crossingY < opening.top + radius - EPSILON || crossingY > opening.bottom - radius + EPSILON) return null;
  return { side, scorer: side === "left" ? "p2" : "p1" };
}
