import { afterEach, describe, expect, it, vi } from "vitest";
import { clickPosition, eventBeaconBody, track } from "../lib/track";

afterEach(() => {
  vi.restoreAllMocks();
  // jsdom does not implement sendBeacon; remove any stub between tests.
  // @ts-expect-error optional cleanup
  delete navigator.sendBeacon;
});

describe("clickPosition", () => {
  it("is 1-based on the first page", () => {
    expect(clickPosition(1, 0, 24)).toBe(1);
    expect(clickPosition(1, 5, 24)).toBe(6);
  });

  it("accounts for earlier pages", () => {
    expect(clickPosition(2, 0, 24)).toBe(25);
    expect(clickPosition(3, 3, 24)).toBe(52);
  });
});

describe("eventBeaconBody", () => {
  it("serializes the event payload", () => {
    expect(
      eventBeaconBody({ type: "click", query: "sofa", productId: 42, position: 3 }),
    ).toBe(JSON.stringify({ type: "click", query: "sofa", productId: 42, position: 3 }));
  });
});

describe("track", () => {
  it("sends via sendBeacon when available", () => {
    const beacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = beacon;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    track({ type: "search", query: "sofa", mode: "hybrid", resultCount: 12 });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe("/api/events");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to fetch keepalive when sendBeacon is missing", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    track({ type: "click", query: "rug", productId: 7, position: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/events");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
  });

  it("falls back to fetch when sendBeacon refuses the payload", () => {
    navigator.sendBeacon = vi.fn().mockReturnValue(false);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    track({ type: "click", query: "rug", productId: 7, position: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
