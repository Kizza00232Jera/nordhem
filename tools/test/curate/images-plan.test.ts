import { describe, expect, it } from "vitest";
import { canonicalClass, photoPhrase, planAssignments } from "../../src/curate/images-plan.ts";

describe("canonicalClass", () => {
  it("picks the taxonomy segment from pipe-joined classes", () => {
    expect(canonicalClass("Bed Frames|Beds", "beds")).toBe("Bed Frames");
    expect(canonicalClass("Teen Beds|Beds", "beds")).toBe("Beds");
    expect(canonicalClass("Area Rugs", "rugs")).toBe("Area Rugs");
  });
});

describe("photoPhrase", () => {
  it("maps canonical classes to photo-friendly search phrases", () => {
    expect(photoPhrase("Beds")).toBe("cozy bedroom bed");
    expect(photoPhrase("Area Rugs")).toBe("area rug living room");
    expect(photoPhrase("Office Chairs")).toBe("office chair");
  });

  it("falls back to the lowercased class name", () => {
    expect(photoPhrase("Some New Class")).toBe("some new class");
  });
});

describe("planAssignments", () => {
  const pool = [
    { id: 11, phrase: "cozy bedroom bed" },
    { id: 12, phrase: "cozy bedroom bed" },
    { id: 21, phrase: "area rug living room" },
  ];

  it("round-robins distinct photos within a phrase, in productId order", () => {
    const plan = planAssignments(
      [
        { productId: 3, phrase: "cozy bedroom bed" },
        { productId: 1, phrase: "cozy bedroom bed" },
        { productId: 2, phrase: "cozy bedroom bed" },
      ],
      pool,
    );

    // Sorted by productId; photos cycle 11, 12, 11.
    expect(plan).toEqual([
      { productId: 1, photoId: 11 },
      { productId: 2, photoId: 12 },
      { productId: 3, photoId: 11 },
    ]);
  });

  it("skips products whose phrase has no photos in the pool", () => {
    const plan = planAssignments(
      [{ productId: 9, phrase: "garden statue" }],
      pool,
    );
    expect(plan).toEqual([]);
  });
});
