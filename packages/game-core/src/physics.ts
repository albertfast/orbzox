import { collisionSubsteps, FIXED_DT } from "./config.js";
import type { GameConfig } from "./config.js";
import { resolveCircleCollision, resolveRectangleWalls, resolveWallSegment } from "./collisions.js";
import type { WallSegment } from "./collisions.js";
import { detectGoalCrossing, goalOpening } from "./goals.js";
import type { GoalCrossing } from "./goals.js";
import { limitVector } from "./math.js";
import { PLAYER_IDS } from "./types.js";
import type { MatchState } from "./types.js";

function ballSideWalls(config: GameConfig): WallSegment[] {
  const { top, bottom } = goalOpening(config);
  const { width, height } = config.arena;
  const walls: WallSegment[] = [];
  for (const x of [0, width]) {
    const inward = x === 0 ? 1 : -1;
    const pocketEnd = x - inward * config.ball.radius * 2;
    walls.push(
      { start: { x, y: 0 }, end: { x, y: top }, inwardNormal: { x: inward, y: 0 } },
      { start: { x, y: bottom }, end: { x, y: height }, inwardNormal: { x: inward, y: 0 } },
      // Short goal rails keep the whole ball inside the opening until it crosses.
      { start: { x, y: top }, end: { x: pocketEnd, y: top }, inwardNormal: { x: 0, y: 1 } },
      { start: { x, y: bottom }, end: { x: pocketEnd, y: bottom }, inwardNormal: { x: 0, y: -1 } },
    );
  }
  return walls;
}

export function clampSpeeds(state: MatchState, config: GameConfig): void {
  for (const id of PLAYER_IDS) limitVector(state.players[id].velocity, config.player.maxSpeed);
  limitVector(state.ball.velocity, config.ball.maxSpeed);
}

export function integratePhysics(state: MatchState, config: GameConfig): GoalCrossing | null {
  const substeps = collisionSubsteps(config);
  const dt = FIXED_DT / substeps;
  const walls = ballSideWalls(config);
  const bodies = [state.players.p1, state.players.p2, state.ball];
  for (let step = 0; step < substeps; step++) {
    const previousBall = { ...state.ball.position };
    for (const body of bodies) {
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
    }
    for (let iteration = 0; iteration < config.physics.collisionIterations; iteration++) {
      resolveCircleCollision(state.players.p1, config.player, state.players.p2, config.player, config.physics.collisionRestitution);
      for (const id of PLAYER_IDS) {
        resolveCircleCollision(state.players[id], config.player, state.ball, config.ball, config.physics.collisionRestitution);
      }
      for (const id of PLAYER_IDS) {
        resolveRectangleWalls(state.players[id], config.player.radius, config.arena.width, config.arena.height, config.player.wallRestitution);
      }
      resolveRectangleWalls(state.ball, config.ball.radius, config.arena.width, config.arena.height, config.ball.wallRestitution, false);
      for (const wall of walls) resolveWallSegment(state.ball, config.ball.radius, config.ball.wallRestitution, wall);
      clampSpeeds(state, config);
    }
    const goal = detectGoalCrossing(previousBall, state.ball.position, config);
    if (goal !== null) return goal;
  }
  return null;
}
