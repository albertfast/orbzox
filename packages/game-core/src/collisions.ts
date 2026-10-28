import { EPSILON } from "./math.js";
import type { BodyState, Vector2 } from "./types.js";

export interface CircleMaterial {
  readonly radius: number;
  readonly mass: number;
}

/** Impulse plus inverse-mass-weighted positional correction; separating bodies receive no impulse. */
export function resolveCircleCollision(a: BodyState, materialA: CircleMaterial, b: BodyState, materialB: CircleMaterial, restitution: number): boolean {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.hypot(dx, dy);
  const radius = materialA.radius + materialB.radius;
  if (distance >= radius) return false;

  let nx = 1;
  let ny = 0;
  if (distance > EPSILON) {
    nx = dx / distance;
    ny = dy / distance;
  } else {
    // Exact overlap has no geometric normal. Prefer the incoming relative direction.
    const rx = a.velocity.x - b.velocity.x;
    const ry = a.velocity.y - b.velocity.y;
    const relativeSpeed = Math.hypot(rx, ry);
    if (relativeSpeed > EPSILON) {
      nx = rx / relativeSpeed;
      ny = ry / relativeSpeed;
    }
  }
  const inverseA = 1 / materialA.mass;
  const inverseB = 1 / materialB.mass;
  const inverseSum = inverseA + inverseB;
  const correction = (radius - distance + EPSILON) / inverseSum;
  a.position.x -= nx * correction * inverseA;
  a.position.y -= ny * correction * inverseA;
  b.position.x += nx * correction * inverseB;
  b.position.y += ny * correction * inverseB;

  const closingSpeed = (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
  if (closingSpeed < 0) {
    const impulse = -(1 + restitution) * closingSpeed / inverseSum;
    a.velocity.x -= impulse * nx * inverseA;
    a.velocity.y -= impulse * ny * inverseA;
    b.velocity.x += impulse * nx * inverseB;
    b.velocity.y += impulse * ny * inverseB;
  }
  return true;
}

export interface WallSegment {
  readonly start: Vector2;
  readonly end: Vector2;
  readonly inwardNormal: Vector2;
}

/** A segment with circular endpoint contacts models goalposts without square corner gaps. */
export function resolveWallSegment(body: BodyState, radius: number, restitution: number, wall: WallSegment): void {
  const sx = wall.end.x - wall.start.x;
  const sy = wall.end.y - wall.start.y;
  const lengthSquared = sx * sx + sy * sy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((body.position.x - wall.start.x) * sx + (body.position.y - wall.start.y) * sy) / lengthSquared))
    : 0;
  const dx = body.position.x - (wall.start.x + t * sx);
  const dy = body.position.y - (wall.start.y + t * sy);
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return;
  const nx = distance > EPSILON ? dx / distance : wall.inwardNormal.x;
  const ny = distance > EPSILON ? dy / distance : wall.inwardNormal.y;
  body.position.x += nx * (radius - distance + EPSILON);
  body.position.y += ny * (radius - distance + EPSILON);
  const normalSpeed = body.velocity.x * nx + body.velocity.y * ny;
  if (normalSpeed < 0) {
    body.velocity.x -= (1 + restitution) * normalSpeed * nx;
    body.velocity.y -= (1 + restitution) * normalSpeed * ny;
  }
}

export function resolveRectangleWalls(body: BodyState, radius: number, width: number, height: number, restitution: number, includeSides = true): void {
  if (body.position.y < radius) {
    body.position.y = radius;
    if (body.velocity.y < 0) body.velocity.y *= -restitution;
  }
  if (body.position.y > height - radius) {
    body.position.y = height - radius;
    if (body.velocity.y > 0) body.velocity.y *= -restitution;
  }
  if (!includeSides) return;
  if (body.position.x < radius) {
    body.position.x = radius;
    if (body.velocity.x < 0) body.velocity.x *= -restitution;
  }
  if (body.position.x > width - radius) {
    body.position.x = width - radius;
    if (body.velocity.x > 0) body.velocity.x *= -restitution;
  }
}
