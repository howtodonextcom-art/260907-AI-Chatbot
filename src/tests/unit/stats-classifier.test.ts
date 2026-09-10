import { describe, expect, it } from "vitest";
import { findStatsCandidate } from "@/ai/orchestration/stats-classifier";

describe("findStatsCandidate", () => {
  it("extracts a DATA=[...] tag with 2+ numbers", () => {
    const c = findStatsCandidate("Tần suất xuất hiện: DATA=[3, 5, 2, 8, 4]");
    expect(c).not.toBeNull();
    expect(c?.values).toEqual([3, 5, 2, 8, 4]);
    expect(c?.verifiedFragment).toBe("DATA=[3, 5, 2, 8, 4]");
  });

  it("supports decimals and negative numbers", () => {
    const c = findStatsCandidate("DATA=[-1.5, 2.25, 0, -3]");
    expect(c?.values).toEqual([-1.5, 2.25, 0, -3]);
  });

  it("is case-insensitive on the tag", () => {
    const c = findStatsCandidate("data=[1,2,3]");
    expect(c?.values).toEqual([1, 2, 3]);
  });

  it("requires at least 2 values — a single number is not a dataset", () => {
    expect(findStatsCandidate("DATA=[7]")).toBeNull();
  });

  it("returns null when no DATA= tag exists at all", () => {
    // Same false-positive concern class as the arithmetic classifier: a
    // sentence merely containing numbers must never trigger this tool.
    expect(
      findStatsCandidate("MT4/MT5 upload, v1/v2, 20 users x $15, 4K/8K")
    ).toBeNull();
  });

  it("returns null for malformed brackets", () => {
    expect(findStatsCandidate("DATA=[1, 2")).toBeNull();
    expect(findStatsCandidate("DATA=1, 2, 3]")).toBeNull();
  });

  it("reports accurate match offsets for coverage computation", () => {
    const text = "Kiểm tra độ đều: DATA=[1,2,3,4]";
    const c = findStatsCandidate(text);
    expect(c).not.toBeNull();
    if (!c) return;
    expect(text.slice(c.matchStart, c.matchEnd)).toBe(c.verifiedFragment);
  });
});
