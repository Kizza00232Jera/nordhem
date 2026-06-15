export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  /** Consecutive failures that trip the breaker open. */
  failureThreshold: number;
  /** How long to stay open before allowing a single half-open trial. */
  cooldownMs: number;
  /** Injectable clock (defaults to Date.now) so transitions are testable. */
  now?: () => number;
}

/**
 * A small circuit breaker (D12). When the PC search service stops answering,
 * the breaker opens so the Next.js backend stops waiting on it and serves the
 * Postgres fallback instead; after a cooldown it lets one trial request through
 * to see whether the service has recovered.
 */
export class CircuitBreaker {
  private state: BreakerState = "closed";
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly opts: BreakerOptions) {}

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  /** Whether to attempt the protected call now (may transition open -> half-open). */
  canRequest(): boolean {
    if (this.state === "open") {
      if (this.now() - this.openedAt >= this.opts.cooldownMs) {
        this.state = "half-open";
        return true; // allow a single trial
      }
      return false;
    }
    return true; // closed or half-open
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.state === "half-open" || this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.openedAt = this.now();
    }
  }

  get current(): BreakerState {
    return this.state;
  }
}
