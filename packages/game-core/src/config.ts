export const SIMULATION_HZ = 60;
export const FIXED_DT = 1 / SIMULATION_HZ;

export interface GameConfig {
  readonly arena: Readonly<{ width: number; height: number; goalHeight: number }>;
  readonly player: Readonly<{ radius: number; mass: number; acceleration: number; damping: number; maxSpeed: number; wallRestitution: number }>;
  readonly ball: Readonly<{ radius: number; mass: number; damping: number; maxSpeed: number; wallRestitution: number }>;
  readonly pulse: Readonly<{ radius: number; ballImpulse: number; opponentImpulse: number; recoilFactor: number; maxRecoilSpeed: number; cooldownSeconds: number }>;
  readonly rules: Readonly<{ regulationSeconds: number; scoreToWin: number; countdownSeconds: number; goalCelebrationSeconds: number }>;
  readonly physics: Readonly<{ collisionRestitution: number; collisionIterations: number; maxSubsteps: number }>;
}

export type GameConfigOverrides = { readonly [K in keyof GameConfig]?: Partial<GameConfig[K]> };

export function secondsToTicks(seconds: number): number {
  const ticks = Math.round(seconds * SIMULATION_HZ);
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isSafeInteger(ticks) || Math.abs(ticks - seconds * SIMULATION_HZ) > 1e-8) {
    throw new RangeError("Duration must be positive and aligned to a 60 Hz tick");
  }
  return ticks;
}

function range(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be finite and between ${min} and ${max}`);
  }
}

/** Enough substeps that maximum relative travel is at most half the smallest radius. */
export function collisionSubsteps(config: GameConfig): number {
  return Math.max(1, Math.ceil(2 * Math.max(config.player.maxSpeed, config.ball.maxSpeed) * FIXED_DT / (0.5 * Math.min(config.player.radius, config.ball.radius))));
}

export function validateGameConfig(config: GameConfig): void {
  range("arena.width", config.arena.width, 4, 100);
  range("arena.height", config.arena.height, 3, 100);
  range("player.radius", config.player.radius, 0.05, 1);
  range("ball.radius", config.ball.radius, 0.05, 1);
  range("arena.goalHeight", config.arena.goalHeight, 2 * config.ball.radius + 0.1, config.arena.height - 0.5);
  range("player.mass", config.player.mass, 0.1, 100);
  range("ball.mass", config.ball.mass, 0.1, 100);
  range("player.acceleration", config.player.acceleration, 0, 200);
  range("player.damping", config.player.damping, 0, 30);
  range("ball.damping", config.ball.damping, 0, 30);
  range("player.maxSpeed", config.player.maxSpeed, 0.1, 100);
  range("ball.maxSpeed", config.ball.maxSpeed, 0.1, 100);
  range("player.wallRestitution", config.player.wallRestitution, 0, 1);
  range("ball.wallRestitution", config.ball.wallRestitution, 0, 1);
  range("physics.collisionRestitution", config.physics.collisionRestitution, 0, 1);
  range("pulse.radius", config.pulse.radius, 0.1, 10);
  range("pulse.ballImpulse", config.pulse.ballImpulse, 0, 100);
  range("pulse.opponentImpulse", config.pulse.opponentImpulse, 0, 100);
  range("pulse.recoilFactor", config.pulse.recoilFactor, 0, 1);
  range("pulse.maxRecoilSpeed", config.pulse.maxRecoilSpeed, 0, 10);
  range("pulse.cooldownSeconds", config.pulse.cooldownSeconds, FIXED_DT, 10);
  range("rules.regulationSeconds", config.rules.regulationSeconds, FIXED_DT, 3600);
  range("rules.countdownSeconds", config.rules.countdownSeconds, FIXED_DT, 10);
  range("rules.goalCelebrationSeconds", config.rules.goalCelebrationSeconds, FIXED_DT, 10);
  range("rules.scoreToWin", config.rules.scoreToWin, 1, 100);
  range("physics.collisionIterations", config.physics.collisionIterations, 1, 12);
  range("physics.maxSubsteps", config.physics.maxSubsteps, 1, 64);
  for (const value of [config.rules.scoreToWin, config.physics.collisionIterations, config.physics.maxSubsteps]) {
    if (!Number.isInteger(value)) throw new RangeError("Scores and solver budgets must be integers");
  }
  for (const value of [config.pulse.cooldownSeconds, config.rules.regulationSeconds, config.rules.countdownSeconds, config.rules.goalCelebrationSeconds]) {
    secondsToTicks(value);
  }
  if (config.player.radius >= config.arena.width * 0.2 || config.player.radius + config.ball.radius >= config.arena.width * 0.3 || 2 * config.player.radius >= config.arena.height) {
    throw new RangeError("Spawn geometry must fit without overlap");
  }
  if (collisionSubsteps(config) > config.physics.maxSubsteps) {
    throw new RangeError("Speed/radius tuning exceeds the collision substep budget");
  }
}

export function createGameConfig(overrides: GameConfigOverrides = {}): GameConfig {
  const config: GameConfig = {
    arena: Object.freeze({ width: 16, height: 9, goalHeight: 3, ...overrides.arena }),
    player: Object.freeze({ radius: 0.35, mass: 3, acceleration: 30, damping: 3.5, maxSpeed: 6, wallRestitution: 0.15, ...overrides.player }),
    ball: Object.freeze({ radius: 0.22, mass: 1, damping: 0.25, maxSpeed: 18, wallRestitution: 0.9, ...overrides.ball }),
    pulse: Object.freeze({ radius: 2.4, ballImpulse: 18, opponentImpulse: 3.6, recoilFactor: 0.12, maxRecoilSpeed: 1.2, cooldownSeconds: 1.2, ...overrides.pulse }),
    rules: Object.freeze({ regulationSeconds: 75, scoreToWin: 5, countdownSeconds: 3, goalCelebrationSeconds: 1.5, ...overrides.rules }),
    physics: Object.freeze({ collisionRestitution: 0.85, collisionIterations: 6, maxSubsteps: 32, ...overrides.physics }),
  };
  validateGameConfig(config);
  return Object.freeze(config);
}

export const DEFAULT_CONFIG = createGameConfig();
