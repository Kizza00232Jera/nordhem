import { beforeEach, describe, expect, it } from "vitest";
import { CircuitBreaker } from "../lib/circuit-breaker";

// The circuit breaker (D12): when the PC search service stops answering, stop
// hammering it and serve the Postgres fallback, then probe occasionally to see
// if it is back. Pure state machine with an injected clock, so transitions are
// deterministic.
describe("CircuitBreaker", () => {
  let clock = 0;
  const now = () => clock;
  const make = () => new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, now });
  beforeEach(() => {
    clock = 0;
  });

  it("starts closed and allows requests", () => {
    const b = make();
    expect(b.current).toBe("closed");
    expect(b.canRequest()).toBe(true);
  });

  it("stays closed below the failure threshold", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    expect(b.current).toBe("closed");
    expect(b.canRequest()).toBe(true);
  });

  it("opens after the threshold and blocks during the cooldown", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    b.recordFailure();
    expect(b.current).toBe("open");
    expect(b.canRequest()).toBe(false);
  });

  it("allows a half-open trial once the cooldown elapses", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    b.recordFailure();
    clock = 1000;
    expect(b.canRequest()).toBe(true);
    expect(b.current).toBe("half-open");
  });

  it("closes again on a successful trial", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    b.recordFailure();
    clock = 1000;
    b.canRequest();
    b.recordSuccess();
    expect(b.current).toBe("closed");
    expect(b.canRequest()).toBe(true);
  });

  it("re-opens immediately if the trial fails, restarting the cooldown", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    b.recordFailure();
    clock = 1000;
    b.canRequest(); // half-open
    b.recordFailure();
    expect(b.current).toBe("open");
    expect(b.canRequest()).toBe(false); // cooldown restarted at 1000
    clock = 2000;
    expect(b.canRequest()).toBe(true);
  });

  it("resets the failure count after a success", () => {
    const b = make();
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    b.recordFailure();
    expect(b.current).toBe("closed"); // only 2 failures since the reset
  });
});
