import { describe, expect, it } from "vitest";
import { cloneMatch, createGameConfig, createMatch, DEFAULT_CONFIG, NEUTRAL_INPUTS, secondsToTicks, setPlayerReady, stepMatch } from "@orvli/game-core";
import { advance, arrangeGoal, FAST_CONFIG, inputs, playing } from "../helpers.js";

describe("match lifecycle", () => {
  it("waits for two ready players, counts 3 seconds, and starts with a full clock", () => {
    const state = createMatch();
    setPlayerReady(state, "p1", true);
    stepMatch(state, inputs({ moveX: 1, pulsePressed: true }));
    expect(state.phase).toBe("waiting");
    expect(state.tick).toBe(0);
    expect(setPlayerReady(state, "p2", true)).toEqual([{ type: "countdown-started", tick: 0 }]);
    advance(state, 179, inputs({ moveX: 1, pulsePressed: true }), DEFAULT_CONFIG);
    expect(state.phase).toBe("countdown");
    expect(state.phaseTicksRemaining).toBe(1);
    expect(state.players.p1.position.x).toBe(3.2);
    expect(stepMatch(state)).toEqual([{ type: "kickoff", tick: 180, round: 1 }]);
    expect(state.phase).toBe("playing");
    expect(state.regulationTicksRemaining).toBe(4500);
    expect(state.players.p1.pulseCooldownTicks).toBe(0);
  });

  it("cancels and restarts the full countdown when readiness is revoked", () => {
    const state = createMatch();
    setPlayerReady(state, "p1", true);
    setPlayerReady(state, "p2", true);
    stepMatch(state);
    expect(setPlayerReady(state, "p2", false)[0]?.type).toBe("countdown-cancelled");
    expect(state.phase).toBe("waiting");
    setPlayerReady(state, "p2", true);
    expect(state.phaseTicksRemaining).toBe(180);
  });

  it("ignores readiness changes during live play", () => {
    const state = playing();
    const before = cloneMatch(state);
    expect(setPlayerReady(state, "p1", false, FAST_CONFIG)).toEqual([]);
    expect(state).toEqual(before);
  });

  it("runs exactly 4500 active ticks before tied regulation enters overtime", () => {
    const state = playing();
    advance(state, 4499);
    expect(state.period).toBe("regulation");
    expect(state.regulationTicksRemaining).toBe(1);
    const events = stepMatch(state, inputs(), FAST_CONFIG);
    expect(state.period).toBe("overtime");
    expect(state.phase).toBe("playing");
    expect(state.regulationTicksRemaining).toBe(0);
    expect(events.filter((event) => event.type === "overtime-started")).toHaveLength(1);
    expect(state.winner).toBeNull();
    advance(state, 300);
    expect(state.period).toBe("overtime");
    expect(state.regulationTicksRemaining).toBe(0);
  });

  it("declares the regulation leader when the clock expires", () => {
    const state = playing();
    state.score = { p1: 2, p2: 3 };
    state.regulationTicksRemaining = 1;
    stepMatch(state, inputs(), FAST_CONFIG);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("p2");
    expect(state.finishReason).toBe("regulation");
  });

  it("celebrates once, pauses the clock, then resets positions and cooldowns", () => {
    const config = createGameConfig();
    const state = playing(config);
    state.players.p1.pulseCooldownTicks = 20;
    arrangeGoal(state, "p1", config);
    expect(stepMatch(state, NEUTRAL_INPUTS, config).filter((event) => event.type === "goal")).toHaveLength(1);
    const remaining = state.regulationTicksRemaining;
    for (let i = 0; i < secondsToTicks(config.rules.goalCelebrationSeconds); i++) {
      const events = stepMatch(state, inputs({ pulsePressed: true }), config);
      expect(events.some((event) => event.type === "goal" || event.type === "pulse")).toBe(false);
      expect(state.regulationTicksRemaining).toBe(remaining);
    }
    expect(state.phase).toBe("playing");
    expect(state.score).toEqual({ p1: 1, p2: 0 });
    expect(state.ball.position).toEqual({ x: 8, y: 4.5 });
    expect(state.ball.velocity).toEqual({ x: 0, y: 0 });
    expect(state.players.p1.pulseCooldownTicks).toBe(0);
    expect(state.round).toBe(2);
  });

  it("ends immediately on the fifth goal without another reset", () => {
    const state = playing();
    for (let goal = 1; goal <= 5; goal++) {
      arrangeGoal(state, "p1");
      const events = stepMatch(state, inputs(), FAST_CONFIG);
      expect(events.filter((event) => event.type === "goal")).toHaveLength(1);
      expect(state.score.p1).toBe(goal);
      if (goal < 5) advance(state, 2);
    }
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("p1");
    expect(state.finishReason).toBe("score-limit");
    expect(state.regulationTicksRemaining).toBeGreaterThan(0);
    const completed = cloneMatch(state);
    for (let i = 0; i < 180; i++) expect(stepMatch(state, inputs({ moveX: 1, pulsePressed: true }), FAST_CONFIG)).toEqual([]);
    expect(state).toEqual(completed);
  });

  it("allows a final-tick equalizer and a sudden-death winner after the reset", () => {
    const state = playing();
    state.score.p2 = 1;
    state.regulationTicksRemaining = 1;
    arrangeGoal(state, "p1");
    const events = stepMatch(state, inputs(), FAST_CONFIG);
    expect(events.map((event) => event.type)).toEqual(["goal", "overtime-started"]);
    expect(state.score).toEqual({ p1: 1, p2: 1 });
    expect(state.period).toBe("overtime");
    expect(state.phase).toBe("goal-celebration");
    advance(state, 2);
    arrangeGoal(state, "p2");
    expect(stepMatch(state, inputs(), FAST_CONFIG).map((event) => event.type)).toEqual(["goal", "match-ended"]);
    expect(state.winner).toBe("p2");
    expect(state.finishReason).toBe("overtime");
  });

  it("awards a final-tick winning goal before considering overtime", () => {
    const state = playing();
    state.regulationTicksRemaining = 1;
    arrangeGoal(state, "p1");
    const events = stepMatch(state, inputs(), FAST_CONFIG);
    expect(events.map((event) => event.type)).toEqual(["goal", "match-ended"]);
    expect(state.winner).toBe("p1");
    expect(state.finishReason).toBe("regulation");
  });

  it("can create a clean next match without retaining previous state", () => {
    const previous = playing();
    previous.score.p1 = 4;
    arrangeGoal(previous, "p1");
    stepMatch(previous, inputs(), FAST_CONFIG);
    const next = createMatch(FAST_CONFIG);
    expect(next.score).toEqual({ p1: 0, p2: 0 });
    expect(next.ready).toEqual({ p1: false, p2: false });
    expect(next.phase).toBe("waiting");
    expect(next.winner).toBeNull();
    next.ball.position.x = 9;
    expect(previous.ball.position.x).not.toBe(9);
  });

  it("returns detached snapshots with no shared nested vectors or counters", () => {
    const state = playing();
    const snapshot = cloneMatch(state);
    snapshot.players.p1.position.x = 99;
    snapshot.players.p2.velocity.x = 99;
    snapshot.score.p1 = 99;
    snapshot.ready.p1 = false;
    snapshot.ball.position.x = 99;
    expect(state).toEqual(playing());
  });
});
