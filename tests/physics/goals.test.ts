import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, detectGoalCrossing, stepMatch } from "@orvli/game-core";
import { arrangeGoal, FAST_CONFIG, inputs, playing } from "../helpers.js";

describe("goal geometry", () => {
  it("requires the entire ball to cross, for both goals", () => {
    expect(detectGoalCrossing({ x: 0.1, y: 4.5 }, { x: -0.1, y: 4.5 }, DEFAULT_CONFIG)).toBeNull();
    expect(detectGoalCrossing({ x: 0.1, y: 4.5 }, { x: -0.22, y: 4.5 }, DEFAULT_CONFIG)).toEqual({ side: "left", scorer: "p2" });
    expect(detectGoalCrossing({ x: 15.9, y: 4.5 }, { x: 16.22, y: 4.5 }, DEFAULT_CONFIG)).toEqual({ side: "right", scorer: "p1" });
  });

  it("uses crossing-time height, rather than the segment endpoint", () => {
    expect(detectGoalCrossing({ x: 1, y: 1 }, { x: -1, y: 5 }, DEFAULT_CONFIG)).toEqual({ side: "left", scorer: "p2" });
    expect(detectGoalCrossing({ x: 0, y: 1 }, { x: -2, y: 4.5 }, DEFAULT_CONFIG)).toBeNull();
  });

  it("requires the whole ball to fit inside the goal opening", () => {
    expect(detectGoalCrossing({ x: 0, y: 3.21 }, { x: -1, y: 3.21 }, DEFAULT_CONFIG)).toBeNull();
    expect(detectGoalCrossing({ x: 0, y: 3.22 }, { x: -1, y: 3.22 }, DEFAULT_CONFIG)).not.toBeNull();
    expect(detectGoalCrossing({ x: 0, y: 5.79 }, { x: -1, y: 5.79 }, DEFAULT_CONFIG)).toBeNull();
  });

  it("does not recount a ball already past the plane or returning to the arena", () => {
    expect(detectGoalCrossing({ x: -0.22, y: 4.5 }, { x: -1, y: 4.5 }, DEFAULT_CONFIG)).toBeNull();
    expect(detectGoalCrossing({ x: -1, y: 4.5 }, { x: 0, y: 4.5 }, DEFAULT_CONFIG)).toBeNull();
  });

  it.each(["p1", "p2"] as const)("credits the correct attacking player: %s", (scorer) => {
    const state = playing();
    arrangeGoal(state, scorer);
    const events = stepMatch(state, inputs(), FAST_CONFIG);
    expect(state.score[scorer]).toBe(1);
    expect(events.filter((event) => event.type === "goal")).toHaveLength(1);
    expect(state.phase).toBe("goal-celebration");
  });
});
