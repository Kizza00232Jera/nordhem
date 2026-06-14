import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../lib/track";
import { TrackSearch } from "../app/components/track-search";
import { TrackedLink } from "../app/components/tracked-link";

// Mock only the transport: these tests assert the components fire the RIGHT
// events. The beacon mechanics themselves are covered in track.test.ts.
vi.mock("../lib/track", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/track")>();
  return { ...actual, track: vi.fn() };
});

beforeEach(() => {
  vi.mocked(track).mockClear();
});

describe("TrackSearch", () => {
  it("fires one search event on mount", () => {
    render(<TrackSearch query="sofa" mode="hybrid" resultCount={12} latencyMs={40} />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      type: "search",
      query: "sofa",
      mode: "hybrid",
      resultCount: 12,
      latencyMs: 40,
    });
  });

  it("fires a zero-result search event (no latency) too", () => {
    render(<TrackSearch query="xyzzy" mode="lexical" resultCount={0} />);
    expect(track).toHaveBeenCalledWith({
      type: "search",
      query: "xyzzy",
      mode: "lexical",
      resultCount: 0,
    });
  });
});

describe("TrackedLink", () => {
  it("fires a click event with its position when clicked", async () => {
    render(
      <TrackedLink href="/product/x" query="sofa" productId={42} position={3}>
        open
      </TrackedLink>,
    );
    await userEvent.click(screen.getByText("open"));
    expect(track).toHaveBeenCalledWith({ type: "click", query: "sofa", productId: 42, position: 3 });
  });
});
