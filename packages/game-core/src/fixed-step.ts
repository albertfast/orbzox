import { FIXED_DT } from "./config.js";

export interface StepReport {
  readonly steps: number;
  readonly alpha: number;
  readonly droppedSeconds: number;
}

/** Caller supplies elapsed monotonic time. Dropped time must be observed by the future host. */
export class FixedStepClock {
  private accumulator = 0;
  private readonly maxSteps: number;
  private readonly maxElapsedSeconds: number;

  constructor(options: { maxSteps?: number; maxElapsedSeconds?: number } = {}) {
    this.maxSteps = options.maxSteps ?? 8;
    this.maxElapsedSeconds = options.maxElapsedSeconds ?? 0.25;
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 1 || this.maxSteps > 240) throw new RangeError("Invalid fixed-step budget");
    if (!Number.isFinite(this.maxElapsedSeconds) || this.maxElapsedSeconds < FIXED_DT || this.maxElapsedSeconds > 4) throw new RangeError("Invalid elapsed-time cap");
  }

  advance(elapsedSeconds: number, step: () => void): StepReport {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError("Elapsed time must be finite and non-negative");
    const accepted = Math.min(elapsedSeconds, this.maxElapsedSeconds);
    this.accumulator += accepted;
    const available = Math.floor((this.accumulator + 1e-12) / FIXED_DT);
    const steps = Math.min(available, this.maxSteps);
    for (let i = 0; i < steps; i++) {
      step();
      this.accumulator -= FIXED_DT;
    }
    const droppedSteps = available - steps;
    this.accumulator = Math.max(0, this.accumulator - droppedSteps * FIXED_DT);
    return {
      steps,
      alpha: Math.min(1, this.accumulator / FIXED_DT),
      droppedSeconds: elapsedSeconds - accepted + droppedSteps * FIXED_DT,
    };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
